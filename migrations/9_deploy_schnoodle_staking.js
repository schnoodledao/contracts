// migrations/9_deploy_schnoodle_staking.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractName = 'SchnoodleStakingV1';

module.exports = async function (deployer, network) {
  const Schnoodle = artifacts.require('SchnoodleV1');
  const schnoodle = await Schnoodle.deployed();

  // Deploy SchnoodleStaking proxy contract
  const SchnoodleStaking = artifacts.require(contractName);
  const schnoodleStaking = await deployProxy(SchnoodleStaking, [schnoodle.address], { deployer });
  if (network === 'develop') return;

  // Transfer ownership of SchnoodleStaking to SchnoodleGovernance
  const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  (await SchnoodleStaking.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);

  const contractsFile = require('../scripts/contracts-file.js');
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(schnoodleStaking.address)}`);
};
