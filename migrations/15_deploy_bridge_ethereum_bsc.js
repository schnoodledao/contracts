// migrations/15_deploy_bridge_ethereum_bsc.js

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });

module.exports = async function (deployer, network) {
  const { bridgeOwners } = require(`../migrations-config.${network}.js`);
  const Schnoodle = artifacts.require('SchnoodleV1');
  const schnoodle = await Schnoodle.deployed();

  const contractName = `Bridge${['chapel', 'bsc'].includes(network) ? 'Bsc' : 'Ethereum'}`;

  const Bridge = artifacts.require(contractName);
  const bridge = await deployer.deploy(Bridge, schnoodle.address);
  await bridge.transferOwnership(bridgeOwners);

  const contractsFile = require('../scripts/contracts-file.js');
  contractsFile.append(`${contractName}@${(await Bridge.deployed()).address}`);
};
