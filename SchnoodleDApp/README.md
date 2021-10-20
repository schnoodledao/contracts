# Schnoodle DApp
Schnoodle X is a DApp to allow interact with the Schnoodle smart contract via a web browser interface.

# Prerequisites
- [Node.js](https://nodejs.org/)
- [Visual Studio 2022 Preview](https://visualstudio.microsoft.com/vs/preview/)
- Local blockchain (use [`truffle develop`](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#develop) or [Ganache](https://www.trufflesuite.com/ganache))

# Setup
Execute the following commands in a `truffle develop` console:
1. `compile --all`
1. `migrate`
1. `exec scripts\initialize.js`

# Run
1. Execute `npm i`
1. Open **Schnoodle.sln** in Visual Studio 2022.
1. Build and run.