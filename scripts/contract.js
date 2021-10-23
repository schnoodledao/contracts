// scripts/contract.js

module.exports = {
  upgrade: async function (deployer, network, contractName) {
    if (network === 'develop') {
      const { testContract } = require(`../migrations-config.${network}.js`);
      if (contractName != testContract) return;
    }

    const SchnoodleNew = artifacts.require(contractName);
    const SchnoodleOld = artifacts.require('SchnoodleV1');

    const proxyAddress = (await SchnoodleOld.deployed()).address;

    if (network === 'develop') {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      await upgradeProxy(proxyAddress, SchnoodleNew, { deployer });
    } else {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      const contractsFile = require('../scripts/contracts-file.js');
      const schnoodleNewAddress = await prepareUpgrade(proxyAddress, SchnoodleNew);

      const proxyAdmin = await admin.getInstance();
      console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
      console.log("Proxy address:", proxyAddress);
      console.log("Implementation address:", schnoodleNewAddress);

      contractsFile.append(`${contractName}@${schnoodleNewAddress}`);
    }

    return proxyAddress;
  }
}
