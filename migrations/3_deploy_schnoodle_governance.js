// migrations/3_deploy_schnoodle_governance.js

const { admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleGovernance';
const SchnoodleGovernance = artifacts.require(contractName);
const Schnoodle = artifacts.require("SchnoodleV1");

module.exports = async function (deployer, network) {
  if (network === 'develop') return;

  const { governance } = require(`../migrations-config.${network}.js`);

  await deployer.deploy(SchnoodleGovernance, governance.minDelay, governance.proposers, governance.executors);
  const schnoodleGovernanceAddress = (await SchnoodleGovernance.deployed()).address;
  await admin.transferProxyAdminOwnership(schnoodleGovernanceAddress);
  await (await Schnoodle.deployed()).transferOwnership(schnoodleGovernanceAddress);

  contractsFile.append(contractName);
};
