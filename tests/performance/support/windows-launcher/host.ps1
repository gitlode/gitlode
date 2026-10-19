$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
try {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  Add-Type -Path (Join-Path $PSScriptRoot 'Job.cs'), (Join-Path $PSScriptRoot 'Transport.cs') -ReferencedAssemblies System.dll, System.Core.dll, System.Web.Extensions.dll
  [LauncherTransport]::Run($watch.Elapsed.TotalMilliseconds)
} catch {
  [Console]::Error.WriteLine('launcher host failure; retain root')
  exit 1
}
