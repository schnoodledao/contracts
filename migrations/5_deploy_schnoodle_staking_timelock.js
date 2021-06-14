// migrations/5_deploy_schnoodle_staking_timelock.js

const moment = require("moment");
const { stakingTimelock } = require('../migrations-config.js');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleStakingTimelock';
const SchnoodleStakingTimelock = artifacts.require(contractName);
const Schnoodle = artifacts.require("Schnoodle");

module.exports = async function (deployer) {
  await deployer.deploy(
    SchnoodleStakingTimelock,
    (await Schnoodle.deployed()).address,
    stakingTimelock.beneficiary,
    moment().add(stakingTimelock.releaseTime, stakingTimelock.releaseTimeUnit).unix());

  contractsFile.append(contractName);
};
