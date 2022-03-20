// migrations/15_deploy_bridge_ethereum_bsc.js

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });

module.exports = async function (deployer, network) {
  const { bridgeOwner } = require(`../migrations-config.${network}.js`);
  const Schnoodle = artifacts.require('SchnoodleV1');
  const schnoodle = await Schnoodle.deployed();

  const contractName = `Bridge${['chapel', 'bsc'].includes(network) ? 'Bsc' : 'Ethereum'}`;

  const Bridge = artifacts.require(contractName);
  const bridge = await deployer.deploy(Bridge, schnoodle.address);
  await bridge.transferOwnership(bridgeOwner);

  const { appendList, isProduction } = require('../scripts/contracts.js');
  if (!isProduction(network)) {
    await schnoodle.transfer(bridge.address, BigInt(1e9) * BigInt(10 ** await schnoodle.decimals()));
  }

  appendList(`${contractName}@${bridge.address}`, network);
};
