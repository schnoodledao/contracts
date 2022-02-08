# Bridge DApp
Schnoodle Bridge is a DApp to interact with the bridge smart contracts to swap tokens between different blockchains.

# Prerequisites
- [Node.js](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)

# Server Setup
1. Execute `npm i`.
1. Open **Server** folder in Visual Studio Code.
1. Execute `node encrypt` and note the two output messages.
1. Execute `node server` in two separate terminals.
1. Call each server endpoint `WriteSecretKey` with POST request and body `{"message": "<message>"}` where `<message>` is one of the two output messages noted above (one for each server).