# Schnoodle DApp
Schnoodle X is a DApp to allow interaction with the Schnoodle smart contract via a web browser interface.

# Prerequisites
- [Node.js](https://nodejs.org/)
- [Visual Studio 2022 Preview](https://visualstudio.microsoft.com/vs/preview/)
- Local blockchain (use [Truffle Develop](https://www.trufflesuite.com/docs/truffle/getting-started/using-truffle-develop-and-the-console#truffle-develop) or [Ganache](https://www.trufflesuite.com/ganache))

# Setup
Execute the following commands in a `truffle develop` console:
1. `compile --all`
1. `migrate`
1. `exec scripts/initialize.js`

# Run
1. Execute `npm i`.
1. Open **Schnoodle.sln** in Visual Studio 2022.
1. Build and run.
1. Connect MetaMask to local network (e.g., http://localhost:7545). You will need to reset MetaMask (in advanced settings) if the network was restarted since the previous run.
1. Add the first account private key in Truffle Develop to MetaMask and select this account.