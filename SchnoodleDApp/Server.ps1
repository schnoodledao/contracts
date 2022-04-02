Push-Location $PSScriptRoot\Server
$env:DOTENV_CONFIG_PATH=".env.development"
$Process = Start-Process node ("-r", "dotenv/config", "server")
if ($Process.ExitCode -ne 0) { Start-Process node encrypt }
Pop-Location