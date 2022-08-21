// migrations/3_deploy_schnoodle_governance.js

const { admin } = require('@openzeppelin/truffle-upgrades');

const contractName = 'SchnoodleGovernance';
const SchnoodleGovernance = artifacts.require(contractName);
const Schnoodle = artifacts.require("SchnoodleV1");

module.exports = async function (deployer, network) {
  const { isProduction } = require('../scripts/contracts.js');
  if (!isProduction(network)) return;

  const { governance } = require(`../migrations-config.${network}.js`);

  await deployer.deploy(SchnoodleGovernance, governance.minDelay, governance.proposers, governance.executors);

  // Transfer ownership of contract to SchnoodleGovernance
  const schnoodleGovernanceAddress = (await SchnoodleGovernance.deployed()).address;
  await admin.transferProxyAdminOwnership(schnoodleGovernanceAddress);
  await (await Schnoodle.deployed()).transferOwnership(schnoodleGovernanceAddress);

  const { appendList } = require('../scripts/contracts.js');
  appendList(contractName, network);
};
