// migrations/2_deploy_schnoodle.js

const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'Schnoodle';
const Schnoodle = artifacts.require(contractName);

module.exports = async function (deployer) {
  const proxy = await deployProxy(Schnoodle, { deployer });
  contractsFile.append(`${contractName}@${await (await admin.getInstance()).getProxyImplementation(proxy.address)}`);
};
