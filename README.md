# Schnoodle
Schnoodle is a progressive DeFi dog-themed meme token with multisig and DAO governance. The first of its kind.

# Prerequisites
- [Node.js](https://nodejs.org)
- [PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-core-on-windows) 7 or later
- Local blockchain (use [Truffle Develop](https://www.trufflesuite.com/docs/truffle/getting-started/using-truffle-develop-and-the-console#truffle-develop) or [Ganache](https://www.trufflesuite.com/ganache))

# Setup
## Gnosis Safe
- Create Safe on [Gnosis Safe](https://gnosis-safe.io/app) (mainnet) or equivalent testnet (e.g., [Rinkeby](https://rinkeby.gnosis-safe.io/app)).
- Update `governance.proposers` and `governance.executors` in `migrations-config.[chain].js` with Safe address (tutorial [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) if required).

## Snapshot / SafeSnap
- Create a Snapshot space [here](https://snapshot.org/#/setup) using [this guide](https://docs.snapshot.org/spaces/create).
- Deploy and enable a SafeSnap DAO module instance with a default template as per the 'Setting up the module' instructions [here](https://github.com/gnosis/dao-module/blob/main/docs/setup_guide.md#setting-up-the-module).
- Integrate the DAO module instance into Snapshot by adding the SafeSnap plugin to [Snapshot space settings](https://snapshot.org/#/schnoodle.eth/settings) with config `{ "address": "<DAO module address>" }`.

# Migrate
Execute the following PowerShell script to migrate (and verify) contracts:
```
.\Migrate.ps1 [<network>] [<reset>] [<remigrate>] [<rebuild>]
```
A description of each parameter is in the PowerShell script itself. In general, set `remigrate` to `$true` to remigrate all contracts to a network that has been previously migrated to.

If a migration fails due to rate limiting on the RPC node, continue the migration by rerunning the script with only the `network` parameter specified.

## Launch Steps
1. Execute `npm i`.
1. Migrate `SchnoodleV1`, `SchnoodleGovernance`, and `SchnoodleTimelockFactory`.
1. Note the 'To' contract address of the `create_0_1` internal transaction of the `SchnoodleTimelockFactory` Contract Creation transaction. Verify the `SchnoodleTimelock` contract using this address.
1. Add liquidity to Uniswap V2, and note the liquidity token address (UNI-V2 token) from the corresponding transaction.
1. [Create a timelock contract](#create-timelock-contract) to lock the full amount of the liquidity token held by the beneficiary wallet.

## Create Timelock Contract
1. Go to `SchnoodleTimelockFactory` contract address and call `create` specifying the address of the token to be locked, the beneficiary, and the release time as a [Unix timestamp](https://www.unixtimestamp.com).
1. Once the transaction has been mined, note the 'To' contract address of the `call_0_1` internal transaction. Verify that this is the `SchnoodleTimelock` clone address.
1. Go to the address of the token to be locked, and transfer the desired amount to the `SchnoodleTimelock` clone address.
1. After timelock elapsed, go to `SchnoodleTimelock` clone address, and call `release`.

## Config Procedure
1. Perform a [contract interaction](#contract-interaction) with `TransparentUpgradeableProxy` to call `changeFeePercent` or `changeEleemosynary`.

## Upgrade Procedure
1. Migrate `SchnoodleVX` (`prepareUpgrade`)
1. Perform a [contract interaction](#contract-interaction) with `ProxyAdmin` to call `upgrade` using `proxy` and `implementation` parameters outputted in step 1.

## Contract Interaction
Contract interaction is via either 1) multisig (SafeSnap optional) if `SchnoodleGovernance` is the contract owner, or 2) SafeSnap (DAO) directly if the Gnosis Safe address is the contract owner. The contract owner may be set during deployment or by calling `transferOwnership` on the contract. A multisig contract can be made into a DAO contract by following the [multisig](#multisig) process using the `transferOwnership` function.

### Multisig
1. Go to the contract address to be interacted with and call the desired function.
1. Copy the HEX DATA from MetaMask and reject the transaction.
1. Follow steps 27 and 28 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272).
1. Follow steps 29 and 30 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) per either of the following scenarios:
    * **Multisig only:** After timelock elapsed.
    * **DAO:** Interact with `SchnoodleGovernance` via the [SafeSnap](#safesnap) process instead of directly.

### SafeSnap
1. Go to [Snapshot space settings](https://snapshot.org/#/schnoodle.eth/settings) and ensure `address` in strategy is the `TransparentUpgradeableProxy` contract address.
1. Go to [Snapshot space new proposal](https://snapshot.org/#/schnoodle.eth/create) and add a 'Contract Interaction' transaction:
    * `to` is the contract address to be interacted with.
    * `function` is the function to be called.
    * Set the parameters as required.
1. After voting is closed, anyone may trigger the following actions on the plugin:
    * Request execution to put the question on [reality.eth](https://reality.eth.link/app/) for 24 hours.
    * Set the outcome with a bond (in ETH). The outcome should resolve in accordance with the vote in (game) theory.
    * After the question outcome is finalised and it is in favour, the upgrade transaction may be triggered by anyone to be executed on the interaction contract.
1. If the proposal is malicious, it may be vetoed during the 24-hour cooldown period via Gnosis Safe by calling `markProposalInvalid` on the DAO module contract address.
    * The `proposalId` and `txHashes` values may be found from the `Input Data` of the relevant `Add Proposal` transaction on the DAO module contract.