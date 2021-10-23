// migrations/8_upgrade_schnoodlev5.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  const schnoodle = await contract.upgrade(deployer, network, 'SchnoodleV5');

  // Deploy SchnoodleStaking proxy contract
  const { deployProxy } = require('@openzeppelin/truffle-upgrades');
  const SchnoodleStaking = artifacts.require('SchnoodleStaking');
  const schnoodleStaking = await deployProxy(SchnoodleStaking, [schnoodle.address], { deployer, unsafeAllow: ['delegatecall'] });
  if (network === 'develop') return;

  // Transfer ownership of SchnoodleStaking to SchnoodleGovernance
  const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  (await SchnoodleStaking.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);

  // Grant the STAKING_CONTRACT role in the Schnoodle contract to SchnoodleStaking
  schnoodle.grantRole(proxy.STAKING_CONTRACT, schnoodleStaking.address);
};
