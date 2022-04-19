// migrations/2_deploy_schnoodlev1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractName = 'SchnoodleV1';

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
const { singletons } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const { initialBurn, initialization } = require(`../migrations-config.${network}.js`);
  let serviceAccount = initialization.serviceAccount;
  let eleemosynary = initialization.eleemosynary;

  if (network === 'develop') {
    serviceAccount = accounts[0];
    eleemosynary = accounts[1];
    // In a test environment an ERC-777 token requires an ERC-1820 registry to be deployed
    await singletons.ERC1820Registry(serviceAccount);
  }

  const Contract = artifacts.require(contractName);
  const instance = await deployProxy(Contract, [initialization.initialTokens, serviceAccount], { deployer });
  await instance.changeFeePercent(initialization.feePercent);
  await instance.changeEleemosynary(eleemosynary, initialization.donationPercent);
  if (initialBurn) await instance.burn(BigInt((initialization.initialTokens - 1) * 10 ** await instance.decimals()), 0);

  const { appendList } = require('../scripts/contracts.js');
  appendList(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(instance.address)}`, network);
};
