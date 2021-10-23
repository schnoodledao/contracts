// migrations/8_prepare_schnoodlev5.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  const proxyAddress = contract.upgrade(deployer, network, 'SchnoodleV5');

  const { deployProxy } = require('@openzeppelin/truffle-upgrades');
  const SchnoodleStaking = artifacts.require('SchnoodleStaking');
  await deployProxy(SchnoodleStaking, [proxyAddress], { deployer });
  if (network === 'develop') return;

  const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  (await SchnoodleStaking.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);
};
