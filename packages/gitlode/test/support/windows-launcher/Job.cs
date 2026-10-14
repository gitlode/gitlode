using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;
public sealed class JobProbe : IDisposable {
  [DllImport("kernel32", SetLastError=true, CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObjectW(IntPtr sa, string name);
  [DllImport("kernel32", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int cls,IntPtr data,uint size);
  [DllImport("kernel32", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int cls,IntPtr data,uint size,IntPtr length);
  [DllImport("kernel32", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
  [DllImport("kernel32", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attr,IntPtr value,IntPtr size,IntPtr prev,IntPtr returned);
  [DllImport("kernel32")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CreateProcessW(string app,StringBuilder cmd,IntPtr psa,IntPtr tsa,bool inherit,uint flags,IntPtr env,string cwd,ref SX startup,out PI info);
  [DllImport("kernel32", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
  [DllImport("kernel32", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
  [DllImport("kernel32")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
  [DllImport("kernel32")] static extern bool CloseHandle(IntPtr handle);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct SI {
    public int cb; public string reserved,desktop,title;
    public uint x,y,xsize,ysize,xchars,ychars,fill,flags;
    public ushort show,reserved2; public IntPtr reservedPtr,input,output,error;
  }
  [StructLayout(LayoutKind.Sequential)] struct SX { public SI si; public IntPtr attrs; }
  [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process,thread; public uint pid,tid; }
  [StructLayout(LayoutKind.Sequential)] struct SA { public int size; public IntPtr descriptor; public int inherit; }
  [DllImport("kernel32", SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SA security,uint size);
  [DllImport("kernel32", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
  [DllImport("kernel32", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32", SetLastError=true, CharSet=CharSet.Unicode)] static extern IntPtr CreateFileW(string name,uint access,uint share,ref SA security,uint creation,uint flags,IntPtr template);
  IntPtr job, leader;
  public Task<byte[]> Stdout, Stderr;
  public bool DenyObservation;
  public static string Quote(string value) {
    StringBuilder b = new StringBuilder("\""); int slashes=0;
    foreach(char c in value) {
      if(c=='\\') { slashes++; continue; }
      if(c=='"') b.Append('\\',slashes*2+1); else b.Append('\\',slashes);
      slashes=0; b.Append(c);
    }
    b.Append('\\',slashes*2); return b.Append('"').ToString();
  }
  static Task<byte[]> Drain(IntPtr handle) {
    return Task.Factory.StartNew(delegate {
      using(var stream=new FileStream(new SafeFileHandle(handle,true),FileAccess.Read))
      using(var retained=new MemoryStream()) {
        byte[] buffer=new byte[4096]; int n;
        while((n=stream.Read(buffer,0,buffer.Length))!=0) {
          int keep=Math.Min(n,65536-(int)retained.Length); if(keep>0) retained.Write(buffer,0,keep);
        }
        return retained.ToArray();
      }
    });
  }
  public uint ExitCode() { uint code; Check(GetExitCodeProcess(leader,out code)); return code; }

  public uint Pid {get; private set;}
  public bool InJob {get; private set;}
  public static bool HostInJob() { bool b; Check(IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out b)); return b; }
  static void Check(bool ok) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public JobProbe() {
    if(IntPtr.Size != 8) throw new NotSupportedException("x64-only layout prototype");
    job=CreateJobObjectW(IntPtr.Zero,null); if(job==IntPtr.Zero) Check(false);
    IntPtr limits=Marshal.AllocHGlobal(144);
    try { for(int i=0;i<144;i++) Marshal.WriteByte(limits,i,0); Marshal.WriteInt32(limits,16,0x2000); Check(SetInformationJobObject(job,9,limits,144)); }
    catch { Dispose(); throw; } finally { Marshal.FreeHGlobal(limits); }
  }
  public void Launch(string exe,string[] args,string cwd,string environment) {
    IntPtr size=IntPtr.Zero;
    InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
    if(size==IntPtr.Zero) Check(false);
    IntPtr attrs=Marshal.AllocHGlobal(size), value=Marshal.AllocHGlobal(IntPtr.Size); bool initialized=false;
    IntPtr handles=Marshal.AllocHGlobal(IntPtr.Size*3), env=IntPtr.Zero;
    IntPtr outRead=IntPtr.Zero,outWrite=IntPtr.Zero,errRead=IntPtr.Zero,errWrite=IntPtr.Zero,input=IntPtr.Zero;
    SA security=new SA(); security.size=Marshal.SizeOf(typeof(SA)); security.inherit=1;
    try {
      Check(InitializeProcThreadAttributeList(attrs,2,0,ref size)); initialized=true;
      Marshal.WriteIntPtr(value,job);
      Check(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x2000D),value,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
      Check(CreatePipe(out outRead,out outWrite,ref security,0));
      Check(CreatePipe(out errRead,out errWrite,ref security,0));
      Check(SetHandleInformation(outRead,1,0)); Check(SetHandleInformation(errRead,1,0));
      input=CreateFileW("NUL",0x80000000,3,ref security,3,0,IntPtr.Zero); if(input==new IntPtr(-1)) Check(false);
      Marshal.WriteIntPtr(handles,0,input); Marshal.WriteIntPtr(handles,IntPtr.Size,outWrite); Marshal.WriteIntPtr(handles,IntPtr.Size*2,errWrite);
      Check(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20002),handles,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero));
      SX sx=new SX(); sx.si.cb=Marshal.SizeOf(typeof(SX)); sx.attrs=attrs; sx.si.flags=0x100;
      sx.si.input=input; sx.si.output=outWrite; sx.si.error=errWrite; PI pi;
      StringBuilder command=new StringBuilder(Quote(exe)); foreach(string arg in args) command.Append(" ").Append(Quote(arg));
      env=Marshal.StringToHGlobalUni(environment);
      Check(CreateProcessW(exe,command,IntPtr.Zero,IntPtr.Zero,true,0x08080400,env,cwd,ref sx,out pi));
      leader=pi.process; Pid=pi.pid; CloseHandle(pi.thread);
      bool inJob; Check(IsProcessInJob(leader,job,out inJob)); InJob=inJob;
      if(!inJob) throw new InvalidOperationException("creation-time containment absent");
      Stdout=Drain(outRead); outRead=IntPtr.Zero; Stderr=Drain(errRead); errRead=IntPtr.Zero;
    } finally { if(initialized) DeleteProcThreadAttributeList(attrs); Marshal.FreeHGlobal(attrs); Marshal.FreeHGlobal(value); Marshal.FreeHGlobal(handles);
      if(env!=IntPtr.Zero) Marshal.FreeHGlobal(env);
      foreach(IntPtr h in new IntPtr[]{outRead,outWrite,errRead,errWrite,input}) if(h!=IntPtr.Zero && h!=new IntPtr(-1)) CloseHandle(h);
    }
  }
  public bool LeaderExited() { return leader!=IntPtr.Zero && WaitForSingleObject(leader,0)==0; }
  public uint Active() {
    if(DenyObservation || job==IntPtr.Zero) throw new InvalidOperationException("observation unavailable: job handle closed");
    IntPtr data=Marshal.AllocHGlobal(48);
    try { Check(QueryInformationJobObject(job,1,data,48,IntPtr.Zero)); return unchecked((uint)Marshal.ReadInt32(data,40)); }
    finally { Marshal.FreeHGlobal(data); }
  }
  public void Cancel() { Check(TerminateJobObject(job,123)); }
  public void ObservePipeFailures() {
    // Observe faulted tasks explicitly; IsCompleted alone is not successful pipe settlement.
    if(Stdout!=null && Stdout.IsFaulted) { var error=Stdout.Exception; }
    if(Stderr!=null && Stderr.IsFaulted) { var error=Stderr.Exception; }
  }
  public void CloseJob() { if(job!=IntPtr.Zero) { IntPtr h=job; job=IntPtr.Zero; Check(CloseHandle(h)); } }
  public void Dispose() { try { CloseJob(); } finally { if(leader!=IntPtr.Zero) { IntPtr h=leader; leader=IntPtr.Zero; Check(CloseHandle(h)); } } }
}
