// migrations/4_deploy_liquidity_timelock.js

const moment = require("moment");
const { liquidityLock } = require('../migrations-config.js');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'LiquidityTimelock';
const LiquidityTimelock = artifacts.require(contractName);

module.exports = async function (deployer) {
  await deployer.deploy(
    LiquidityTimelock,
    liquidityLock.tokenAddress,
    liquidityLock.beneficiary,
    moment().add(liquidityLock.releaseTime, liquidityLock.releaseTimeUnit).unix());

  contractsFile.append(contractName);
};
