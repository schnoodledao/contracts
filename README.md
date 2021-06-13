# Schnoodle
Schnoodle is a progressive DeFi dog-themed meme token with multisig and DAO governance. The first of its kind.

# Prerequisites
- [Node.js](https://nodejs.org/)
- Local blockchain (use [`truffle develop`](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#develop) or [Ganache](https://www.trufflesuite.com/ganache))

# Setup
## Gnosis Safe
- Create Safe on [Gnosis Safe](https://gnosis-safe.io/app) (mainnet) or equivalent testnet (e.g., [Rinkeby](https://rinkeby.gnosis-safe.io/app)).
- Update `governance.proposers` and `governance.executors` in `migrations-config.js` with Safe address (tutorial [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) if required).

## Snapshot / SafeSnap
- Create a Snapshot space [here](https://snapshot.org/#/setup) using [this guide](https://docs.snapshot.org/spaces/create).
- Deploy and enable a SafeSnap DAO module instance with a default template as per the 'Setting up the module' instructions [here](https://github.com/gnosis/dao-module/blob/main/docs/setup_guide.md#setting-up-the-module).
- Integrate the DAO module instance into Snapshot by adding the SafeSnap plugin to [Snapshot space settings](https://snapshot.org/#/schnoodle.eth/settings) with config `{ "address": "<DAO module address>" }`.

# Migrate
```
.\Migrate.ps1 [<network>] [<reset>] [<rebuild>]
```
- `network`: The network to run the migration on (default is `development`).
- `reset`: Run all migrations from the beginning (default is `$false`).
- `rebuild`: Delete all compiled contracts and the network manifest (default is `$false`).

## Liquidity Steps
1. Migrate `Schnoodle` and `SchnoodleGovernance`.
1. Add liquidity to Uniswap.
1. Update `liquidityLock.tokenAddress` in `migrations-config.js` with liquidity token address from txn in wallet used for liquidity.
1. Migrate `LiquidityTimelock`.
1. Go to liquidity contract address, and transfer all liquidity tokens to `LiquidityTimelock` contract address.
1. After timelock elapsed, go to `LiquidityTimelock` contract address, and call `release`.

## Upgrade Steps (Multisig)
The following steps assume that `SchnoodleGovernance` is the owner of `ProxyAdmin`.
1. Migrate `SchnoodleV2` (`prepareUpgrade`).
1. Go to `ProxyAdmin` contract address and call `upgrade` using parameters outputted in step 1 (do not confirm).
1. Copy the HEX DATA from MetaMask and reject the txn.
1. Follow steps 27 and 28 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272).
1. After timelock elapsed, follow steps 29 and 30 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272).

## Upgrade Steps (DAO)
The following steps assume that the Gnosis Safe address is the owner of `ProxyAdmin`.
1. Migrate `SchnoodleV2` (`prepareUpgrade`).
1. Go to [Snapshot space settings](https://snapshot.org/#/schnoodle.eth/settings) and update `address` in strategy with proxy address (outputted in step 1).
1. Go to [Snapshot space new proposal](https://snapshot.org/#/schnoodle.eth/create) and add a 'Contract Interaction' transaction:
    * `to` is the `ProxyAdmin` contract address.
    * `function` is `upgrade()`.
    * `proxy` and `implementation` are the parameters outputted in step 1.
1. After voting is closed, anyone may trigger the following actions on the plugin:
    * Request execution to put the question on [reality.eth](https://reality.eth.link/app/) for 24 hours.
    * Set the outcome with a bond (in ETH). The outcome should resolve in accordance with the vote in (game) theory.
    * After the question outcome is finalised and it is in favour, the upgrade transaction may be triggered by anyone to be executed on `ProxyAdmin`.
1. If the proposal is malicious, it may be vetoed during the 24-hour cooldown period via Gnosis Safe by calling `markProposalInvalid` on the DAO module contract address.
    * The `proposalId` and `txHashes` values may be found from the `Input Data` of the relevant `Add Proposal` transaction on the DAO module contract.

**TODO: Should ownership of ProxyAdmin be transferred from SchnoodleGovernance to the Gnosis Safe address?**