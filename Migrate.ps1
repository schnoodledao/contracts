param (
    [string]$Network = "develop",
    [bool]$Reset = $false,
    [bool]$Rebuild = $false
)

$ContractsFile = "contracts.txt"
If (Test-Path $ContractsFile) {
    Remove-Item $ContractsFile
}

$NpxArgs = @("truffle", "migrate", "--network", $Network, "--compile-all")
If ($Reset) {
    $NpxArgs += "--reset"
}

If ($Rebuild) {
    $Filter = ($Network -eq "develop") ? "unknown-*.json" : "$Network.json"
    Remove-Item .openzeppelin\$Filter -ErrorAction Ignore
    Remove-Item build\contracts\*.json
}

$LogsPath = "logs"
If (!(Test-Path $LogsPath)) {
    New-Item -Name $LogsPath -ItemType "directory"
}

$process = Start-Process npx -ArgumentList $NpxArgs -RedirectStandardOutput $LogsPath\migrate-$Network-$(Get-Date -Format FileDateTimeUniversal).log -PassThru -Wait -WindowStyle Hidden

If (($process.ExitCode -eq 0) -and ($Network -ne "develop")) {
    "Waiting till $((Get-Date).AddMinutes(2)) to verify contracts."
    Start-Sleep -s 120
    
    ForEach ($Contract in Get-Content $ContractsFile) {
        npx truffle run verify $Contract --network $Network
    }
}
