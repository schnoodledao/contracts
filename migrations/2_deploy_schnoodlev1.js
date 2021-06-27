// migrations/2_deploy_schnoodlev1.js

const { initialization } = require('../migrations-config.js');
const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV1';
const Schnoodle = artifacts.require(contractName);

module.exports = async function (deployer) {
  const proxy = await deployProxy(Schnoodle, [initialization.initialTokens, initialization.owner], { deployer });
  proxy.setFeePercent(initialization.feePercent);
  proxy.setEleemosynary(initialization.eleemosynary, initialization.eleemosynaryPercent);
  
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(proxy.address)}`);
};
