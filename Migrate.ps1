Param (
    # The network on which the migration will take place, as defined in the Truffle configuration.
    [string]$Network = "develop",
    # Run all migrations from the beginning, instead of running from the last completed migration.
    [bool]$Reset = $false,
    # Delete the manifest for the network to force a complete remigration of everything.
    [bool]$Remigrate = $false,
    # Delete all contract artifacts and recompile all contracts.
    [bool]$Rebuild = $false
)

$CompileArgs = @("truffle", "compile", "--all")
$MigrateArgs = @("truffle", "migrate", "--network", $Network, "--compile-none")

If ($Reset) {
    $MigrateArgs += "--reset"
}

If ($Remigrate) {
    $NetworkIds = @{ "develop" = 1337; "chapel" = 97; "bsc" = 56 }
    $Filter = $NetworkIds.ContainsKey($Network) ? "unknown-$($NetworkIds[$Network]).json" : "$Network.json"
    Remove-Item .openzeppelin\$Filter -ErrorAction Ignore
}

If ($Rebuild) {
    Remove-Item SchnoodleDApp\ClientApp\src\contracts\*.json
    $Process = Start-Process npx -ArgumentList $CompileArgs -NoNewWindow -PassThru -Wait
    If ($Process.ExitCode -ne 0) { Exit }
}

$LogsPath = "logs"
If (!(Test-Path $LogsPath)) {
    New-Item -Name $LogsPath -ItemType "directory"
}

$Process = Start-Process npx -ArgumentList $MigrateArgs -RedirectStandardOutput $LogsPath\migrate-$Network-$(Get-Date -Format FileDateTimeUniversal).log -PassThru -Wait -WindowStyle Hidden

If (($process.ExitCode -eq 0) -and ($Network -ne "develop")) {
    "Waiting till $((Get-Date).AddMinutes(2)) to verify contracts."
    Start-Sleep -s 120
    
    $ContractsFile = "contracts.txt"
    $VerifyFailed = $false;

    ForEach ($Contract in Get-Content $ContractsFile) {
        $VerifyArgs = @("truffle", "run", "verify", $Contract, "--network", $Network)
        $Process = Start-Process npx -ArgumentList $VerifyArgs -NoNewWindow -PassThru -Wait
        If ($Process.ExitCode -ne 0) { $VerifyFailed = $true }
    }

    If (Test-Path $ContractsFile && !$VerifyFailed) {
        Remove-Item $ContractsFile
    }
}
