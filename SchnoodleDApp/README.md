# Schnoodle DApp
Schnoodle X is a DApp to allow interaction with the Schnoodle smart contracts via a web browser interface.

# Prerequisites
- [Node.js](https://nodejs.org/)
- [Visual Studio 2022 Preview](https://visualstudio.microsoft.com/vs/preview/)
    - Workloads 'ASP.NET and web development', 'Desktop development with C++'.
    - Component '.NET Core 2.1 Runtime' (see [here](https://docs.nethereum.com/en/latest/nethereum.autogen.contractapi/#prerequisites)).
- Local blockchain (use [Truffle Develop](https://www.trufflesuite.com/docs/truffle/getting-started/using-truffle-develop-and-the-console#truffle-develop) or [Ganache](https://www.trufflesuite.com/ganache))

The following shared services should be set up **only once** per environment:
1. Create an Azure Cosmos DB account with SQL API [here](https://azure.microsoft.com/en-gb/try/cosmosdb).
    - Production: `schnoodle`
    - Test: `schnoodle-test`
1. Create an Azure storage account [here](https://docs.microsoft.com/en-us/azure/storage/common/storage-account-create).
    - Production: `stschnoodle`
    - Test: `stschnoodletest`

# Setup
1. Run [these Setup steps](../README.md#setup) first.
1. Populate the [Server/secrets.json](Server/secrets.json) file (see [Secrets](#secrets) below).
1. Populate the [secrets.json](secrets.json) file (see [Secrets](#secrets) below), then execute `type .\secrets.json | dotnet user-secrets set`.

## Secrets
1. For `Pinata:Jwt`, register a [Pinata](https://app.pinata.cloud) account, then create an API key.
1. For `Blockchain:PrivateKey`, use any account that has some native test tokens. Ensure this account has the `MINTER_ROLE` role (see [Roles](#roles) below).
1. For `Data:Key`, obtain the read-write primary key for the test Azure Cosmos DB account from the administrator of that account.
1. For `Files:Key`, obtain one of the access keys for the test Azure storage account from the administrator of that account.

# Server
1. Create `.env*` files with the application settings of the test App Service from the administrator of that account. Make the following amendments:
    - `URL=localhost`
    - `BRIDGE_PRIVATE_KEY=`
        - Assign the private key of any account that has some native test tokens. Ensure this account has the `BRIDGE` role (see [Roles](#roles) below).
    - `BRIDGE_PASSWORD=`
        - Assign any suitable unique password.
1. Execute `.\Server.ps1`.

> 📘 Info
>
> Use `npm run init[:dev] -- --server {server}` to initialise a remote server after deployment where `server` is the base URL (e.g., `https://test.server.schnoodle.finance`).

# Client
1. Open [Schnoodle.sln](../Schnoodle.sln) in Visual Studio 2022.
1. Build and run.
1. Connect MetaMask to target network (e.g., Rinkeby or http://localhost:8545). You will need to reset MetaMask (in advanced settings) if the network is local and was restarted since the previous run.
1. Add the first account private key in Truffle Develop to MetaMask, and select this account.

# Roles
To check if an account has a role on the smart contract, use the `hasRole` function. To grant the role, the contract owner must grant it using `grantRole`.
