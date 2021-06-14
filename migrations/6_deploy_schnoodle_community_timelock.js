// migrations/6_deploy_schnoodle_community_timelock.js

const moment = require("moment");
const { communityTimelock } = require('../migrations-config.js');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleCommunityTimelock';
const SchnoodleCommunityTimelock = artifacts.require(contractName);
const Schnoodle = artifacts.require("Schnoodle");

module.exports = async function (deployer) {
  await deployer.deploy(
    SchnoodleCommunityTimelock,
    (await Schnoodle.deployed()).address,
    communityTimelock.beneficiary,
    moment().add(communityTimelock.releaseTime, communityTimelock.releaseTimeUnit).unix());

  contractsFile.append(contractName);
};
