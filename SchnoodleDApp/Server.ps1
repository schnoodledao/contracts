Push-Location $PSScriptRoot\Server
$Process = Start-Process npm "run start:dev"
Start-Sleep -s 5
if ($Process.ExitCode -ne 0) { Start-Process npm "run init:dev -- --server http://localhost:3300" }
Pop-Location