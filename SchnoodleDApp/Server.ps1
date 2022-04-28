Push-Location $PSScriptRoot\Server
$Process = Start-Process npm "run start:dev"
Start-Sleep -s 5
if ($Process.ExitCode -ne 0) { Start-Process node "-r dotenv/config encrypt dotenv_config_path=./.env.development" }
Pop-Location