// migrations/2_deploy_schnoodlev1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV1';
const Schnoodle = artifacts.require(contractName);

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
const { singletons } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const { initialization } = require(`../migrations-config.${network}.js`);

  if (network === 'development') {
    // In a test environment an ERC-777 token requires an ERC-1820 registry to be deployed
    await singletons.ERC1820Registry(accounts[0]);
  }

  const proxy = await deployProxy(Schnoodle, [initialization.initialTokens, initialization.serviceAccount], { deployer });
  proxy.changeFeePercent(initialization.feePercent);
  proxy.changeEleemosynary(initialization.eleemosynary, initialization.donationPercent);
  
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(proxy.address)}`);
};
