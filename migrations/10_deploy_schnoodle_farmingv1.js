// migrations/10_deploy_schnoodle_farmingv1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractName = 'SchnoodleFarmingV1';

module.exports = async function (deployer, network) {
  const Schnoodle = artifacts.require('SchnoodleV1');
  const schnoodle = await Schnoodle.deployed();

  // Deploy SchnoodleFarming proxy contract
  const SchnoodleFarming = artifacts.require(contractName);
  const schnoodleFarming = await deployProxy(SchnoodleFarming, [schnoodle.address], { deployer });
  if (network === 'develop') return;

  // Transfer ownership of SchnoodleFarming to SchnoodleGovernance
  const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  await (await SchnoodleFarming.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);

  const contractsFile = require('../scripts/contracts-file.js');
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(schnoodleFarming.address)}`);
};
