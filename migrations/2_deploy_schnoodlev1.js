// migrations/2_deploy_schnoodlev1.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV1';
const Schnoodle = artifacts.require(contractName);

module.exports = async function (deployer, network) {
  const { initialization } = require(`../migrations-config.${network}.js`);

  const proxy = await deployProxy(Schnoodle, [initialization.initialTokens, initialization.owner], { deployer });
  proxy.changeFeePercent(initialization.feePercent);
  proxy.changeEleemosynary(initialization.eleemosynary, initialization.donationPercent);
  
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(proxy.address)}`);
};
