using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// Only the host owns native handles. Control traffic never shares workload pipes.
public static class LauncherTransport {
  static JavaScriptSerializer json = new JavaScriptSerializer();
  sealed class Entry { public string Id; public JobProbe Job; public Stopwatch Clock=Stopwatch.StartNew(); public bool Exited, Cancelled; }
  static void Send(object value) { Console.WriteLine(json.Serialize(value)); Console.Out.Flush(); }
  public static void Run(double compileMs) {
    if(IntPtr.Size!=8 || Environment.OSVersion.Version.Major<10) throw new NotSupportedException("Windows 10+ x64 required");
    var entries=new Dictionary<string,Entry>(); var ids=new HashSet<string>(); bool sealedAdmission=false;
    Task<string> input=Task.Factory.StartNew(()=>Console.ReadLine());
    Send(new {kind="ready",version=1,compileMs=compileMs,hostInJob=JobProbe.HostInJob()});
    try {
      while(true) {
        if(input.IsCompleted) {
          string line=input.Result; if(line==null) throw new InvalidOperationException("control EOF");
          if(line.Length>1048576) throw new InvalidOperationException("oversized control");
          var message=json.Deserialize<Dictionary<string,object>>(line);
          string kind=(string)message["kind"];
          if(kind=="shutdown") { sealedAdmission=true; foreach(var e in entries.Values) { e.Job.Cancel(); e.Cancelled=true; } }
          else if(kind=="launch") {
            if(sealedAdmission) throw new InvalidOperationException("admission sealed");
            string id=(string)message["id"]; if(!ids.Add(id)) throw new InvalidOperationException("duplicate launch ID");
            var e=new Entry {Id=id,Job=new JobProbe()}; entries.Add(id,e);
            try {
              string exe=(string)message["exe"], cwd=(string)message["cwd"];
              if(!System.IO.Path.IsPathRooted(exe) || !System.IO.Path.IsPathRooted(cwd)) throw new ArgumentException("absolute paths required");
              var raw=(System.Collections.ArrayList)message["args"]; string[] args=new string[raw.Count]; for(int i=0;i<args.Length;i++) args[i]=(string)raw[i];
              e.Job.Launch(exe,args,cwd,(string)message["environment"]);
              Send(new {kind="started",id=id,pid=e.Job.Pid});
            } catch(Exception error) {
              // CreateProcess failure has no leader. Post-create uncertainty is fatal, never a safe launch failure.
              if(e.Job.Pid!=0) throw;
              e.Job.Dispose(); entries.Remove(id); Send(new {kind="launchError",id=id,error=error.ToString()});
            }
          } else if(kind=="cancel" || kind=="denyObservation") {
            Entry e; if(entries.TryGetValue((string)message["id"],out e)) {
              if(kind=="denyObservation") e.Job.DenyObservation=true;
              else { e.Job.Cancel(); e.Cancelled=true; }
            }
          } else throw new InvalidOperationException("unknown control kind");
          input=Task.Factory.StartNew(()=>Console.ReadLine());
        }
        var complete=new List<string>();
        foreach(var e in entries.Values) {
          if(e.Clock.ElapsedMilliseconds>15000) throw new TimeoutException("operation bound; retain root");
          if(!e.Exited && e.Job.LeaderExited()) { e.Exited=true; Send(new {kind="exit",id=e.Id,code=e.Job.ExitCode()}); }
          // Each entry admits exactly one launch, so zero cannot race a later launch into this job.
          if(e.Exited && e.Job.Active()==0 && e.Job.Stdout.IsCompleted && e.Job.Stderr.IsCompleted) {
            Send(new {kind="complete",id=e.Id,absent=true,stdout=Convert.ToBase64String(e.Job.Stdout.Result),stderr=Convert.ToBase64String(e.Job.Stderr.Result),cancelled=e.Cancelled});
            e.Job.Dispose(); complete.Add(e.Id);
          }
        }
        foreach(string id in complete) entries.Remove(id);
        if(sealedAdmission && entries.Count==0) { Send(new {kind="shutdown"}); return; }
        Thread.Sleep(5);
      }
    } catch(Exception error) { Send(new {kind="fatal",error=error.ToString()}); throw; }
    finally { foreach(var e in entries.Values) { try { e.Job.Cancel(); } catch {} e.Job.Dispose(); } }
  }
}
