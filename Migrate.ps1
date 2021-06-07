param (
    [string]$Network = "development",
    [bool]$Reset = $false,
    [bool]$Rebuild = $false
)

$ContractsFile = "contracts.txt"
If (Test-Path $ContractsFile) {
    Remove-Item $ContractsFile
}

$NpxArgs = @("truffle", "migrate", "--network", $Network)
If ($Reset) {
    $NpxArgs += "--reset"
}

If ($Rebuild) {
    $Filter = ($Network -eq "development") ? "unknown-*.json" : "$Network.json"
    Remove-Item .openzeppelin\$Filter -ErrorAction Ignore
}

$LogsPath = "logs"
If (!(Test-Path $LogsPath)) {
    New-Item -Name $LogsPath -ItemType "directory"
}

$process = Start-Process npx -ArgumentList $NpxArgs -RedirectStandardOutput $LogsPath\migrate-$Network.log -PassThru -Wait -WindowStyle Hidden

If (($process.ExitCode -eq 0) -and ($Network -ne "development")) {
    "Waiting till $((Get-Date).AddMinutes(5)) to verify contracts."
    Start-Sleep -s 300
    
    ForEach ($Contract in Get-Content $ContractsFile) {
        npx truffle run verify $Contract --network $Network
    }
}
