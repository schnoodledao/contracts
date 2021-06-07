# Schnoodle
## Prerequisites
- [Node.js](https://nodejs.org/)
- Local blockchain (use [`truffle develop`](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#develop) or [Ganache](https://www.trufflesuite.com/ganache))

## Setup
- Create Safe on [Gnosis Safe](https://gnosis-safe.io/app) (mainnet) or equivalent testnet (e.g., [Rinkeby](https://rinkeby.gnosis-safe.io/app)).
- Update `governance.proposers` and `governance.executors` in `migrations-config.js` with Safe address (tutorial [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) if required).

## Migrate
```
.\Migrate.ps1 [<network>] [<reset>] [<rebuild>]
```
- `network`: The network to run the migration on (default is `development`).
- `reset`: Run all migrations from the beginning (default is `$false`).
- `rebuild`: Delete all compiled contracts and the network manifest (default is `$false`).

### Liquidity Steps
1. Migrate `Schnoodle` and `SchnoodleGovernance`.
1. Add liquidity to Uniswap.
1. Update `liquidityLock.tokenAddress` in `migrations-config.js` with liquidity token address from txn in wallet used for liquidity.
1. Migrate `LiquidityTimelock`.
1. Go to liquidity contract address, and transfer all liquidity tokens to `LiquidityTimelock` contract address.
1. After timelock elapsed, go to `LiquidityTimelock` contract address, and call `release`.

### Upgrade Steps
1. Migrate `SchnoodleV2` (`prepareUpgrade`).
1. Go to `ProxyAdmin` contract address and call `upgrade` using parameters outputted in step 1 (do not confirm).
1. Copy the HEX DATA from MetaMask and reject the txn.
1. Follow steps 27 and 28 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272).
1. After timelock elapsed, follow steps 29 and 30 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272).