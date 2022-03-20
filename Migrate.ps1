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

$MigrateArgs = "truffle", "migrate", "--network", $Network, "--compile-none"
$ContractsFile = "contracts-$Network.txt"

if ($Reset) {
    $MigrateArgs += "--reset"
}

if ($Remigrate) {
    $NetworkIds = @{ "develop" = 1337; "chapel" = 97; "bsc" = 56 }
    $Filter = $NetworkIds.ContainsKey($Network) ? "unknown-$($NetworkIds[$Network]).json" : "$Network.json"
    Remove-Item .openzeppelin\$Filter -ErrorAction Ignore
    Remove-Item $ContractsFile -ErrorAction Ignore
}

if ($Rebuild) {
    Remove-Item SchnoodleDApp\ClientApp\src\contracts\*.json
    $Process = Start-Process npx ("truffle", "compile", "--all") -NoNewWindow -PassThru -Wait
    if ($Process.ExitCode -ne 0) { exit }
}

$LogsPath = "logs"
if (!(Test-Path $LogsPath)) {
    New-Item -Name $LogsPath -ItemType "directory"
}

$Process = Start-Process npx $MigrateArgs -RedirectStandardOutput $LogsPath\migrate-$Network-$(Get-Date -Format FileDateTimeUniversal).log -PassThru -Wait -WindowStyle Hidden

if ($process.ExitCode -eq 0) {
    if ($Network -eq "develop") {
        $Process = Start-Process npx ("truffle", "exec", "scripts/initialize.js", "--network", $Network) -NoNewWindow -PassThru -Wait
    } else {
        "Waiting till $((Get-Date).AddMinutes(2)) to verify contracts."
        Start-Sleep -s 120
        
        $VerifyFailed = $false;

        foreach ($Contract in Get-Content $ContractsFile) {
            $Process = Start-Process npx ("truffle", "run", "verify", $Contract, "--network", $Network) -NoNewWindow -PassThru -Wait
            if ($Process.ExitCode -ne 0) { $VerifyFailed = $true }
        }

        if (!$VerifyFailed) {
            Remove-Item $ContractsFile -ErrorAction Ignore
        }
    }
}
