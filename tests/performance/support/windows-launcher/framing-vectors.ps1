$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
# Compile and exercise only in-memory framing. No Run, native launch, job or workload is invoked.
Add-Type -Path (Join-Path $PSScriptRoot 'Job.cs'), (Join-Path $PSScriptRoot 'Transport.cs') -ReferencedAssemblies System.dll, System.Core.dll, System.Web.Extensions.dll
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$frames = New-Object LauncherFrames
$expected = '{"value":"' + [char]0x65e5 + [char]0x672c + [char]0x8a9e + '"}'
$line = $null
$observed = @()
foreach ($byte in $utf8.GetBytes($expected + "`r`n" + '{}'+"`n")) {
  if ($frames.Feed($byte, [ref]$line)) { $observed += $line }
}
$frames.End()
if ($observed.Count -ne 2 -or $observed[0] -cne $expected -or $observed[1] -cne '{}') { throw 'frame identity mismatch' }
$vectors = New-Object 'System.Collections.Generic.List[byte[]]'
$vectors.Add([byte[]](123,34,120,34,58,34,195,40,34,125,10))
$vectors.Add($utf8.GetBytes("`n"))
$vectors.Add([byte[]](239,187,191,123,125,10))
$vectors.Add($utf8.GetBytes('{}'))
$vectors.Add([byte[]]::new(1048577))
foreach ($vector in $vectors) {
  $frames = New-Object LauncherFrames
  $rejected = $false
  try {
    foreach ($byte in $vector) { [void]$frames.Feed($byte, [ref]$line) }
    $frames.End()
  } catch { $rejected = $true }
  if (-not $rejected) { throw 'malformed frame accepted' }
  try { [void]$frames.Feed(123, [ref]$line); throw 'failed frame reopened' } catch {
    if ($_.Exception.Message -eq 'failed frame reopened') { throw }
  }
}
[Console]::WriteLine('{"nativeFraming":"passed","validFrames":2,"rejectionVectors":5,"nativeLaunches":0}')
