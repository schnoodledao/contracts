// migrations/2_deploy_schnoodlev1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV1';
let Schnoodle = artifacts.require(contractName);

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
const { singletons } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const { initialization, testContract } = require(`../migrations-config.${network}.js`);
  let serviceAccount = initialization.serviceAccount;
  let eleemosynary = initialization.eleemosynary;

  if (network === 'develop') {
    Schnoodle = artifacts.require(testContract);
    serviceAccount = accounts[0];
    eleemosynary = accounts[1];
    // In a test environment an ERC-777 token requires an ERC-1820 registry to be deployed
    await singletons.ERC1820Registry(serviceAccount);
  }

  const proxy = await deployProxy(Schnoodle, [initialization.initialTokens, serviceAccount], { deployer });
  proxy.changeFeePercent(initialization.feePercent);
  proxy.changeEleemosynary(eleemosynary, initialization.donationPercent);

  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(proxy.address)}`);
};
