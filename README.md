# Schnoodle
## Prerequisites
- [Node.js](https://nodejs.org/)
- Local blockchain (use [`truffle develop`](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#develop) or [Ganache](https://www.trufflesuite.com/ganache))

## Setup
- Create Safe on [Gnosis Safe](https://gnosis-safe.io/app) (mainnet) or equivalent testnet (e.g., [Rinkeby](https://rinkeby.gnosis-safe.io/app)).
- Update values in `migrations-config.js` with Uniswap liquidity token address, and Safe address (tutorial [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) if required).

## Migrate
```
.\Migrate.ps1 [<network>] [<reset>] [<rebuild>]
```
`network`: The network to run the migration on (default is `development`)
`reset`: Run all migrations from the beginning (default is `$false`).
`rebuild`: Delete all compiled contracts and the network manifest (default is `$false`).
