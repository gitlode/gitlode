$ErrorActionPreference = 'Stop'
# Finite source-body probes only: replace OS boundaries, never launch a job or workload.
$root = Join-Path (Get-Location) '.cache/stage-b-round2-native-vectors'
[void](New-Item -ItemType Directory -Force -Path $root)
$transport = Get-Content -Raw (Join-Path $PSScriptRoot 'Transport.cs')
$control = @'
  sealed class Control : IDisposable {
    int count;
    public bool TryLine(long end,out string line) {
      line=null;
      if(count++==0) { line="{\"kind\":\"launch\",\"id\":\"1\",\"exe\":\"C:\\\\node.exe\",\"args\":[],\"cwd\":\"C:\\\\root\",\"environment\":\"\\u0000\\u0000\"}"; return true; }
      if(Vector.Mode=="input-dispose") throw Vector.Body;
      return false;
    }
    public void Dispose() { Vector.Actions.Add("input.Dispose"); if(Vector.Mode=="input-dispose") throw Vector.Input; }
  }
'@
$transport = [regex]::Replace($transport, '(?s)  sealed class Control : IDisposable \{.*?\r?\n  sealed class Entry', $control + "`n  sealed class Entry")
# Scale finite test time only; the control flow is the unchanged production body.
$transport = $transport.Replace('entryStart+11000', 'entryStart+30').Replace('entryStart+15000', 'entryStart+70').Replace('4000', '40')
$fakeJob = @'
using System;
using System.Threading;
using System.Threading.Tasks;
public sealed class JobProbe : IDisposable {
 public uint Pid=1;
 public bool DenyObservation;
 public Task<byte[]> Stdout=Task.FromResult(new byte[0]), Stderr=Task.FromResult(new byte[0]);
 public static bool HostInJob() { return false; }
 public JobProbe() { Vector.Actions.Add("construct"); if(Vector.Mode=="construction") Thread.Sleep(45); }
 public void Launch(string exe,string[] args,string cwd,string env,Action deadline) {
   Vector.Actions.Add("launch"); deadline();
   if(Vector.Mode=="launch") Thread.Sleep(45);
 }
 public void Cancel() { Vector.Actions.Add("cancel"); if(Vector.FirstCancel<0) Vector.FirstCancel=Vector.Watch.ElapsedMilliseconds; }
 public bool LeaderExited() { return false; }
 public uint Active() { Vector.Actions.Add("observe"); return 0; }
 public uint ExitCode() { return 0; }
 public void ObservePipeFailures() { Vector.Actions.Add("pipes"); }
 public void Dispose() { Vector.Actions.Add("dispose"); if(Vector.Mode=="input-dispose") throw Vector.Close; }
}
'@
$vectors = @'
using System;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Collections.Generic;
public static class Vector {
 public static string Mode;
 public static List<string> Actions=new List<string>();
 public static System.Diagnostics.Stopwatch Watch;
 public static long FirstCancel;
 public static Exception Body=new IOException("body"), Input=new IOException("input"), Close=new IOException("close");
 sealed class Writer : StringWriter {
  public override void WriteLine(string value) {
   if(value.Contains("started") && Mode=="send") Thread.Sleep(80);
   base.WriteLine(value);
  }
 }
 public static void Run(string mode) {
  Mode=mode; Actions.Clear(); FirstCancel=-1; Watch=System.Diagnostics.Stopwatch.StartNew();
  var writer=new Writer(); var original=Console.Out; Console.SetOut(writer);
  AggregateException failure=null;
  try { LauncherTransport.Run(0); } catch(AggregateException error) { failure=error; }
  finally { Console.SetOut(original); }
  if(failure==null) throw new Exception("expected bounded failure");
  if(!Actions.Contains("cancel") || !Actions.Contains("dispose") || !Actions.Contains("observe")) throw new Exception("cleanup skipped");
  if((mode=="launch" || mode=="construction") && writer.ToString().Contains("started")) throw new Exception("late started");
  if(mode=="input-dispose") {
   var all=failure.Flatten().InnerExceptions;
   if(!all.Contains(Body) || !all.Contains(Input) || !all.Contains(Close)) throw new Exception("lost identity");
  }
  if(mode=="send") {
   // Stop must be requested before waiting for the still-pending native write again.
   if(FirstCancel<0 || FirstCancel>=70) throw new Exception("write spent cleanup reserve");
   if(!failure.ToString().Contains("write unsettled")) throw new Exception("pending write hidden");
  }
 }
}
'@
$transportPath = Join-Path $root 'Transport.cs'
$jobPath = Join-Path $root 'Job.cs'
$vectorPath = Join-Path $root 'Vector.cs'
[IO.File]::WriteAllText($transportPath, $transport)
[IO.File]::WriteAllText($jobPath, $fakeJob)
[IO.File]::WriteAllText($vectorPath, $vectors)
Add-Type -Path $transportPath, $jobPath, $vectorPath -ReferencedAssemblies System.dll, System.Core.dll, System.Web.Extensions.dll
# Each mode needs a fresh host static clock/write state; reset only those production fields.
foreach ($mode in @('construction', 'launch', 'send', 'input-dispose')) {
  $flags = [Reflection.BindingFlags]'Static,NonPublic'
  $type = [LauncherTransport]
  $type.GetField('workEnd', $flags).SetValue($null, [long]::MaxValue)
  $type.GetField('cleanupEnd', $flags).SetValue($null, [long]::MaxValue)
  $writing = $type.GetField('writing', $flags).GetValue($null)
  if ($null -ne $writing) { [void]$writing.Wait(500) }
  $type.GetField('writing', $flags).SetValue($null, $null)
  $type.GetField('clock', $flags).SetValue($null, [Diagnostics.Stopwatch]::StartNew())
  [Vector]::Run($mode)
}
[Console]::WriteLine('{"nativeFailureVectors":"passed","modes":["construction","launch","send","input-dispose"],"nativeLaunches":0}')

# Exercise actual JobProbe close ownership/release bodies with only CloseHandle replaced.
$job = Get-Content -Raw (Join-Path $PSScriptRoot 'Job.cs')
$job = $job.Replace('JobProbe', 'CloseProbe')
$job = [regex]::Replace($job, '\[DllImport\("kernel32", SetLastError=true\)\] static extern bool CloseHandle\(IntPtr handle\);', @'
public static readonly List<IntPtr> CloseCalls=new List<IntPtr>();
static bool CloseHandle(IntPtr handle) { CloseCalls.Add(handle); return handle.ToInt64()!=11 && handle.ToInt64()!=12 && handle.ToInt64()!=13; }
'@)
$job = [regex]::Replace($job, '(?s)  public CloseProbe\(\) \{.*?\r?\n  public void Launch', "  public CloseProbe() {}`n  public void Launch")
$closePath = Join-Path $root 'CloseProbe.cs'
[IO.File]::WriteAllText($closePath, $job)
Add-Type -Path $closePath -ReferencedAssemblies System.dll, System.Core.dll
$probe = New-Object CloseProbe
$flags = [Reflection.BindingFlags]'Instance,NonPublic'
$close = [CloseProbe].GetMethod('CloseOwned', $flags)
foreach ($identity in @(11,12,13,14,15)) { [void]$close.Invoke($probe, @([IntPtr]$identity)) }
# The values stand for failed thread, pipe-writer and NUL handles; remaining releases succeed.
[CloseProbe].GetField('job', $flags).SetValue($probe, [IntPtr]16)
[CloseProbe].GetField('leader', $flags).SetValue($probe, [IntPtr]17)
$failed = $false
try { $probe.Dispose() } catch { $failed = $true }
if (-not $failed -or $probe.FailedCloses.Count -ne 3 -or [CloseProbe]::CloseCalls.Count -ne 7) { throw 'close ownership/continuation failed' }
try { $probe.Dispose() } catch {}
if ([CloseProbe]::CloseCalls.Count -ne 7) { throw 'ambiguous handle retried' }
[Console]::WriteLine('{"closeFailureVectors":"passed","failedIdentities":3,"laterCloses":4,"unsafeRetries":0,"nativeLaunches":0}')
