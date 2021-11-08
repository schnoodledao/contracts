// migrations/9_prepare_schnoodlev6.js

const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleV6';
const SchnoodleNew = artifacts.require(contractName);
const SchnoodleOld = artifacts.require('SchnoodleV1');

module.exports = async function (_deployer) {
  const proxyAddress = (await SchnoodleOld.deployed()).address;
  const schnoodleNewAddress = await prepareUpgrade(proxyAddress, SchnoodleNew);

  const proxyAdmin = await admin.getInstance();
  console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
  console.log("Proxy address:", proxyAddress);
  console.log("Implementation address:", schnoodleNewAddress);

  contractsFile.append(`${contractName}@${schnoodleNewAddress}`);
};
