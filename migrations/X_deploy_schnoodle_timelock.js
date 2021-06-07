// migrations/3_deploy_schnoodle_timelock.js

const moment = require("moment");
const { tokenLock } = require('../migrations-config.js');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleTimelock';
const SchnoodleTimelock = artifacts.require(contractName);
const Schnoodle = artifacts.require("Schnoodle");

module.exports = async function (deployer) {
  await deployer.deploy(
    SchnoodleTimelock,
    (await Schnoodle.deployed()).address,
    tokenLock.beneficiary,
    moment().add(tokenLock.releaseTime, tokenLock.releaseTimeUnit).unix());

  contractsFile.append(contractName);
};
