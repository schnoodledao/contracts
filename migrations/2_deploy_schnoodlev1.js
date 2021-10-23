// migrations/2_deploy_schnoodlev1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV1';
const Schnoodle = artifacts.require(contractName);

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
const { singletons } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const { initialization } = require(`../migrations-config.${network}.js`);
  let serviceAccount = initialization.serviceAccount;
  let eleemosynary = initialization.eleemosynary;

  if (network === 'develop') {
    serviceAccount = accounts[0];
    eleemosynary = accounts[1];
    // In a test environment an ERC-777 token requires an ERC-1820 registry to be deployed
    await singletons.ERC1820Registry(serviceAccount);
  }

  const schnoodle = await deployProxy(Schnoodle, [initialization.initialTokens, serviceAccount], { deployer });
  schnoodle.changeFeePercent(initialization.feePercent);
  schnoodle.changeEleemosynary(eleemosynary, initialization.donationPercent);

  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(schnoodle.address)}`);
};
