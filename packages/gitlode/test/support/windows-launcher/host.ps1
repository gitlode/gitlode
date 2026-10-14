$ErrorActionPreference = 'Stop'
try {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  Add-Type -Path (Join-Path $PSScriptRoot 'Job.cs'), (Join-Path $PSScriptRoot 'Transport.cs') -ReferencedAssemblies System.dll, System.Core.dll, System.Web.Extensions.dll
  [LauncherTransport]::Run($watch.Elapsed.TotalMilliseconds)
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
}
