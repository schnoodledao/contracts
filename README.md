# Schnoodle
Schnoodle is a progressive DeFi dog-themed meme token with multisig and DAO governance. The first of its kind.

# Prerequisites
- [Node.js](https://nodejs.org)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Solidity extension](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity)
- [PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-core-on-windows) 7 or later
- Local blockchain (use [Truffle Develop](https://www.trufflesuite.com/docs/truffle/getting-started/using-truffle-develop-and-the-console#truffle-develop) or [Ganache](https://www.trufflesuite.com/ganache))

Follow these steps **only once** per remote blockchain:
1. Set up Gnosis Safe and Zodiac Reality Module using [this tutorial](https://gnosis.github.io/zodiac/docs/tutorial-module-reality/get-started/). Integrate into the [Schnoodle Snapshot space](https://snapshot.org/#/schnoodle.eth) (which was created using [this guide](https://docs.snapshot.org/spaces/create)).
1. Update `governance.proposers` and `governance.executors` in `migrations-config.[chain].js` with Safe address (tutorial [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) if required).

> ⚠️ Important
>
> Ensure that [`core.symlinks`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-coresymlinks) is true before cloning the repo. Use `git config --get core.symlinks` to check. Run your Git client in administrator mode to allow symlinks to be created.

# Setup
1. Populate the [secrets.json](secrets.json) file (see [Secrets](#secrets) below).
1. Execute `npm i`.
1. In Visual Studio Code, open each Solidity file in the [contracts](contracts) folder corresponding to the ABI files listed in [Nethereum.Generator.json](SchnoodleDApp/Nethereum.Generator.json), and press F5 ('Solidity: Compile Contract' command).
1. If target network is local, execute `truffle develop` in a separate terminal.
1. If target network is remote, check the gas price, and adjust the `gasPrice` value in [truffle-config.js](truffle-config.js) accordingly.
1. Execute `.\Migrate.ps1 <network> $true $true` where `<network>` is the target network per the `networks` property in [truffle-config.js](truffle-config.js).

## Secrets
1. For `mnemonic`, use any account that has some native test tokens.
1. For `infuraProjectId`,  register an [Infura](https://infura.io/register) account, then create a project and get the project ID.
1. For `etherscanApiKey`, register an [Etherscan](https://etherscan.io/register) account, then create an API key.
1. For `bscscanApiKey`, register a [BscScan](https://bscscan.com/register) account, then create an API key.

# Blockchain Launch
1. After migration, note the 'To' contract address of the `create_0_1` internal transaction of the `SchnoodleTimelockFactory` Contract Creation transaction. Verify the `SchnoodleTimelock` contract using this address.
1. Add liquidity to Uniswap V2, and note the liquidity token address (UNI-V2 token) from the corresponding transaction.
1. [Create a timelock contract](#timelock-tokens) to lock the full amount of the liquidity token held by the beneficiary wallet.

# Operational Procedures
## Timelock Tokens
Follow these steps to timelock tokens:
1. Call `create` on `SchnoodleTimelockFactory` specifying the contract address of the token to be locked, the beneficiary, and the release time as a [Unix timestamp](https://www.unixtimestamp.com).
1. Once the transaction has been mined, note the 'To' contract address of the `create_0` internal transaction. Verify that this is the `SchnoodleTimelock` clone address.
1. Transfer the desired amount of tokens to be locked from the token contract address to the `SchnoodleTimelock` clone address.
1. After timelock elapsed, go to `SchnoodleTimelock` clone address, and call `release`.

## Configuration
1. Perform a [contract interaction](#contract-interaction) with `TransparentUpgradeableProxy` to call a function (e.g., `changeFeePercent`, `changeEleemosynary`, `maintenance`, `configure`).

## Contract Upgrade
1. Execute `.\Migrate.ps1 <network>` where `<network>` is the target network per the `networks` property in [truffle-config.js](truffle-config.js).
1. Perform a [contract interaction](#contract-interaction) with `ProxyAdmin` to call `upgrade` using `proxy` and `implementation` parameters outputted in step 1.

## Contract Interaction
Follow the [timelock process](#timelock-process) if the contract owner is `SchnoodleGovernance` which is typically set during deployment. Otherwise, follow the [DAO process](#dao-process) directly. If there are no multisig owners, or they have been removed, ownership of a contract may be transferred to the Gnosis Safe address by calling `transferOwnership` on the contract using the [timelock process](#timelock-process).

### Timelock Process
1. Go to the contract address to be interacted with and call the desired function.
1. Copy the HEX DATA from MetaMask and reject the transaction.
1. Follow steps 27 to 30 from [here](https://forum.openzeppelin.com/t/tutorial-on-using-a-gnosis-safe-multisig-with-a-timelock-to-upgrade-contracts-and-use-functions-in-a-proxy-contract/7272) using the [DAO process](#dao-process) to interact with `SchnoodleGovernance` either 1) optionally for the `execute` step, or 2) if there is no multisig.

### DAO Process
1. Go to [Snapshot space settings](https://snapshot.org/#/schnoodle.eth/settings) and ensure `address` in strategy is the `TransparentUpgradeableProxy` contract address.
1. Go to [Snapshot space new proposal](https://snapshot.org/#/schnoodle.eth/create) and add a 'Contract Interaction' transaction:
    * `to` is the contract address to be interacted with.
    * `function` is the function to be called.
    * Set the parameters as required.
1. After voting is closed, anyone may trigger the following actions on the plugin:
    * Request execution to put the question on [Reality.eth](https://reality.eth.link/app/) for 24 hours.
    * Set the outcome with a bond (in ETH). The outcome should resolve in accordance with the vote in (game) theory.
    * After the question outcome is finalised and it is in favour, the upgrade transaction may be triggered by anyone to be executed on the interaction contract.
1. If the proposal is malicious, it may be vetoed during the 24-hour cooldown period via Gnosis Safe by calling `markProposalAsInvalid` on the Reality Module.
    * The `proposalId` and `txHashes` values may be found from the `Input Data` of the relevant `Add Proposal` transaction on the Reality Module contract.