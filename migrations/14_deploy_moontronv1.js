// migrations/14_deploy_moontronv1.js

const { deployProxy, erc1967 } = require('@openzeppelin/truffle-upgrades');
const contractName = 'MoontronV1';

module.exports = async function (deployer, network) {
  //const Schnoodle = artifacts.require('SchnoodleV1');
  //const schnoodle = await Schnoodle.deployed();

  // OpenSea proxy registry addresses for rinkeby and mainnet.
  const proxyRegistryAddress = network === 'rinkeby' ? "0xf57b2c51ded3a29e6891aba85459d600256cf317" : "0xa5409ec958c83c3f309868babaca7c86dcb077c1";

  // Deploy proxy contract
  const Contract = artifacts.require(contractName);
  const proxy = await deployProxy(Contract, [proxyRegistryAddress], { deployer });
  if (network === 'develop') return;

  // Transfer ownership of contract to SchnoodleGovernance
  //const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  //(await Contract.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);

  const contractsFile = require('../scripts/contracts-file.js');

  erc1967.getImplementationAddress(proxy.address);
  contractsFile.append(`${contractName}@${await erc1967.getImplementationAddress(proxy.address)}`);
};
