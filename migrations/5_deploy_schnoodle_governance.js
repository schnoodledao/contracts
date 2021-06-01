// migrations/5_deploy_schnoodle_governance.js

const { governance } = require('../migrations-config.js');
const { admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleGovernance';
const SchnoodleGovernance = artifacts.require(contractName);

module.exports = async function (deployer) {
  await deployer.deploy(SchnoodleGovernance, governance.minDelay, governance.proposers, governance.executors);
  await admin.transferProxyAdminOwnership((await SchnoodleGovernance.deployed()).address);
  contractsFile.append(contractName);
};
