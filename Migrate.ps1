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

$MigrateArgs = @("truffle", "migrate", "--network", $Network, "--compile-none")

if ($Reset) {
    $MigrateArgs += "--reset"
}

if ($Remigrate) {
    $NetworkIds = @{ "develop" = 1337; "chapel" = 97; "bsc" = 56 }
    $Filter = $NetworkIds.ContainsKey($Network) ? "unknown-$($NetworkIds[$Network]).json" : "$Network.json"
    Remove-Item .openzeppelin\$Filter -ErrorAction Ignore
}

if ($Rebuild) {
    $CompileArgs = @("truffle", "compile", "--all")
    Remove-Item SchnoodleDApp\ClientApp\src\contracts\*.json
    $Process = Start-Process npx -ArgumentList $CompileArgs -NoNewWindow -PassThru -Wait
    if ($Process.ExitCode -ne 0) { exit }
}

$LogsPath = "logs"
if (!(Test-Path $LogsPath)) {
    New-Item -Name $LogsPath -ItemType "directory"
}

$Process = Start-Process npx -ArgumentList $MigrateArgs -RedirectStandardOutput $LogsPath\migrate-$Network-$(Get-Date -Format FileDateTimeUniversal).log -PassThru -Wait -WindowStyle Hidden

if ($process.ExitCode -eq 0) {
    if ($Network -eq "develop") {
        $ExecArgs = @("truffle", "exec", "scripts/initialize.js", "--network", $Network)
        $Process = Start-Process npx -ArgumentList $ExecArgs -NoNewWindow -PassThru -Wait
    } else {
        "Waiting till $((Get-Date).AddMinutes(2)) to verify contracts."
        Start-Sleep -s 120
        
        $ContractsFile = "contracts.txt"
        $VerifyFailed = $false;

        foreach ($Contract in Get-Content $ContractsFile) {
            $VerifyArgs = @("truffle", "run", "verify", $Contract, "--network", $Network)
            $Process = Start-Process npx -ArgumentList $VerifyArgs -NoNewWindow -PassThru -Wait
            if ($Process.ExitCode -ne 0) { $VerifyFailed = $true }
        }

        if (Test-Path $ContractsFile && !$VerifyFailed) {
            Remove-Item $ContractsFile
        }        
    }
}
