// migrations/5_prepare_schnoodlev2.js

const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV2';
const SchnoodleV2 = artifacts.require(contractName);
const SchnoodleV1 = artifacts.require('SchnoodleV1');

module.exports = async function (_deployer) {
  const proxyAddress = (await SchnoodleV1.deployed()).address;
  const schnoodleV2Address = await prepareUpgrade(proxyAddress, SchnoodleV2);

  const proxyAdmin = await admin.getInstance();
  console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
  console.log("Proxy address:", proxyAddress);
  console.log("Implementation address:", schnoodleV2Address);

  contractsFile.append(`${contractName}@${await proxyAdmin.getProxyImplementation(proxyAddress)}`);
};
