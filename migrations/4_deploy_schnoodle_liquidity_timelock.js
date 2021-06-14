// migrations/4_deploy_schnoodle_liquidity_timelock.js

const moment = require("moment");
const { liquidityTimelock } = require('../migrations-config.js');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleLiquidityTimelock';
const SchnoodleLiquidityTimelock = artifacts.require(contractName);

module.exports = async function (deployer) {
  await deployer.deploy(
    SchnoodleLiquidityTimelock,
    liquidityTimelock.tokenAddress,
    liquidityTimelock.beneficiary,
    moment().add(liquidityTimelock.releaseTime, liquidityTimelock.releaseTimeUnit).unix());

  contractsFile.append(contractName);
};
