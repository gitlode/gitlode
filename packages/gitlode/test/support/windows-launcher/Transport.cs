using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;

// Only the host owns native handles. Control traffic never shares workload pipes.
public static class LauncherTransport {
  const int Limit=1048576;
  static JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength=Limit, RecursionLimit=32 };
  static Stopwatch clock=Stopwatch.StartNew();
  static long workEnd=long.MaxValue;
  static long cleanupEnd=long.MaxValue;
  static Task writing;
  // Peek the private control pipe before reading. No uncancellable ReadLine task survives shutdown.
  sealed class Control : IDisposable {
    [DllImport("kernel32", SetLastError=true)] static extern bool PeekNamedPipe(IntPtr handle,IntPtr buffer,uint size,IntPtr read,out uint available,IntPtr left);
    [DllImport("kernel32")] static extern IntPtr GetStdHandle(int number);
    readonly Stream stream=Console.OpenStandardInput();
    readonly IntPtr handle=GetStdHandle(-10);
    readonly LauncherFrames frames=new LauncherFrames();
    readonly byte[] chunk=new byte[4096];
    int offset, count;
    public bool TryLine(out string line) {
      line=null;
      while(true) {
        if(offset==count) {
          uint available;
          if(!PeekNamedPipe(handle,IntPtr.Zero,0,IntPtr.Zero,out available,IntPtr.Zero))
            { frames.End(); throw new IOException("control EOF"); }
          if(available==0) return false;
          count=stream.Read(chunk,0,(int)Math.Min(available,(uint)chunk.Length)); offset=0;
          if(count==0) throw new IOException("control EOF");
        }
        if(frames.Feed(chunk[offset++],out line)) return true;
      }
    }
    public void Dispose() { stream.Dispose(); }
  }
  sealed class Entry { public string Id; public JobProbe Job; public Stopwatch Clock=Stopwatch.StartNew(); public bool Exited, Cancelled; }
  static void Send(object value) {
    if(writing!=null && !writing.IsCompleted) throw new IOException("control write unsettled");
    string text=json.Serialize(value);
    if(Encoding.UTF8.GetByteCount(text)>Limit) throw new IOException("control write bound");
    writing=Task.Factory.StartNew(()=> { Console.WriteLine(text); Console.Out.Flush(); });
    int wait=(int)Math.Max(0,Math.Min(4000,Math.Min(workEnd,cleanupEnd)-clock.ElapsedMilliseconds));
    if(!writing.Wait(wait)) throw new TimeoutException("control write deadline");
  }
  public static void Run(double compileMs) {
    if(IntPtr.Size!=8 || Environment.OSVersion.Version.Major<10) throw new NotSupportedException("Windows 10+ x64 required");
    var entries=new Dictionary<string,Entry>(); var ids=new HashSet<string>(); bool sealedAdmission=false;
    var input=new Control();
    string phase="ready";
    try {
      Send(new {kind="ready",version=1,compileMs=compileMs,hostInJob=JobProbe.HostInJob()});
      while(true) {
        string line;
        phase="control-input";
        if(input.TryLine(out line)) {
          phase="control-schema";
          var message=json.Deserialize<Dictionary<string,object>>(line);
          if(message==null || !message.ContainsKey("kind")) throw new InvalidOperationException("control schema");
          string kind=(string)message["kind"];
          phase="control-kind";
          if(kind=="shutdown") { if(message.Count!=1 || sealedAdmission) throw new InvalidOperationException("shutdown schema/order"); sealedAdmission=true; cleanupEnd=Math.Min(workEnd,clock.ElapsedMilliseconds+4000); workEnd=cleanupEnd; foreach(var e in entries.Values) { e.Job.Cancel(); e.Cancelled=true; } }
          else if(kind=="launch") {
            if(sealedAdmission || message.Count!=6) throw new InvalidOperationException("admission/schema");
            string id=(string)message["id"]; long number;
            if(!long.TryParse(id,out number) || number<=0 || number.ToString()!=id || !ids.Add(id)) throw new InvalidOperationException("invalid launch ID");
            var e=new Entry {Id=id,Job=new JobProbe()}; entries.Add(id,e);
            workEnd=Math.Min(workEnd,clock.ElapsedMilliseconds+15000);
            try {
              string exe=(string)message["exe"], cwd=(string)message["cwd"];
              if(!System.IO.Path.IsPathRooted(exe) || !System.IO.Path.IsPathRooted(cwd)) throw new ArgumentException("absolute paths required");
              var raw=(System.Collections.ArrayList)message["args"]; string[] args=new string[raw.Count]; for(int i=0;i<args.Length;i++) args[i]=(string)raw[i];
              e.Job.Launch(exe,args,cwd,(string)message["environment"]);
              Send(new {kind="started",id=id,pid=e.Job.Pid});
            } catch(Exception error) {
              // CreateProcess failure has no leader. Post-create uncertainty is fatal, never a safe launch failure.
              if(e.Job.Pid!=0) throw;
              e.Job.Dispose(); entries.Remove(id); Send(new {kind="launchError",id=id,error=error.GetType().Name});
            }
          } else if(kind=="cancel" || kind=="denyObservation") {
            if(message.Count!=2 || sealedAdmission || !(message["id"] is string) || !ids.Contains((string)message["id"])) throw new InvalidOperationException("control ID/schema/order");
            Entry e; if(entries.TryGetValue((string)message["id"],out e)) {
              if(kind=="denyObservation") { e.Job.DenyObservation=true; Send(new {kind="faultInjected",id=e.Id,fault="observation-loss"}); }
              else { e.Job.Cancel(); e.Cancelled=true; }
            }
          } else throw new InvalidOperationException("unknown control kind");
        }
        var complete=new List<string>();
        phase="native-observation";
        foreach(var e in entries.Values) {
          if(!sealedAdmission && e.Clock.ElapsedMilliseconds>11000) throw new TimeoutException("operation work cutoff; retain root");
          if(!e.Exited && e.Job.LeaderExited()) { e.Exited=true; Send(new {kind="exit",id=e.Id,code=e.Job.ExitCode()}); }
          // Each entry admits exactly one launch, so zero cannot race a later launch into this job.
          if(e.Exited && e.Job.Active()==0 && e.Job.Stdout.IsCompleted && e.Job.Stderr.IsCompleted) {
            Send(new {kind="complete",id=e.Id,absent=true,stdout=Convert.ToBase64String(e.Job.Stdout.Result),stderr=Convert.ToBase64String(e.Job.Stderr.Result),cancelled=e.Cancelled});
            e.Job.Dispose(); complete.Add(e.Id);
          }
        }
        if(sealedAdmission && clock.ElapsedMilliseconds>=workEnd && entries.Count!=0) throw new TimeoutException("shutdown bound");
        foreach(string id in complete) entries.Remove(id);
        if(entries.Count==0 && !sealedAdmission) workEnd=long.MaxValue;
        if(sealedAdmission && entries.Count==0) { Send(new {kind="shutdown"}); return; }
        Thread.Sleep(5);
      }
    } catch(Exception) {
      sealedAdmission=true;
      cleanupEnd=Math.Min(cleanupEnd,Math.Min(workEnd,clock.ElapsedMilliseconds+4000));
      // Notification failure never replaces the primary exception or skips native cleanup.
      try { Send(new {kind="fatal",error="control/native uncertainty",phase=phase}); } catch {}
      throw;
    }
    finally {
      long end=Math.Min(cleanupEnd,Math.Min(workEnd,clock.ElapsedMilliseconds+4000));
      input.Dispose();
      foreach(var e in entries.Values) { try { e.Job.Cancel(); } catch {} }
      foreach(var e in entries.Values) {
        bool absent=false, pipes=false;
        while(clock.ElapsedMilliseconds<end) {
          try { absent=e.Job.Active()==0; } catch {}
          pipes=(e.Job.Stdout==null || e.Job.Stdout.IsCompleted) && (e.Job.Stderr==null || e.Job.Stderr.IsCompleted);
          if(absent && pipes) break;
          // Observation denial cannot become an absence receipt; still join the drain tasks.
          if(e.Job.DenyObservation && pipes) break;
          Thread.Sleep(5);
        }
        if(!absent || !pipes || (e.Job.Stdout!=null && e.Job.Stdout.IsFaulted) || (e.Job.Stderr!=null && e.Job.Stderr.IsFaulted)) Console.Error.WriteLine("native cleanup uncertainty; retain root");
        e.Job.ObservePipeFailures(); try { e.Job.Dispose(); } catch { Console.Error.WriteLine("native handle close failure; retain root"); }
      }
      if(writing!=null) { try { writing.Wait((int)Math.Max(0,end-clock.ElapsedMilliseconds)); } catch {} }
    }
  }
}
// Used by the real pipe reader and the finite in-memory vectors; no whole ReadLine allocation.
public sealed class LauncherFrames {
  readonly byte[] frame=new byte[1048576];
  int length;
  bool failed;
  public bool Feed(byte b,out string line) {
    line=null;
    if(failed) throw new IOException("control admission sealed");
    try {
      if(b!=10) { if(length==frame.Length) throw new IOException("oversized control"); frame[length++]=b; return false; }
      int size=length; if(size>0 && frame[size-1]==13) size--;
      if(size==0 || (size>=3 && frame[0]==239 && frame[1]==187 && frame[2]==191)) throw new IOException("blank/BOM control");
      line=new UTF8Encoding(false,true).GetString(frame,0,size); length=0; return true;
    } catch { failed=true; throw; }
  }
  public void End() { if(length!=0) { failed=true; throw new IOException("truncated control"); } }
}
