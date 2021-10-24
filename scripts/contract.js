// scripts/contract.js

module.exports = {
  upgrade: async function (deployer, network, contractName) {
    if (network === 'develop') {
      const { testContracts } = require(`../migrations-config.${network}.js`);
      if (contractName != testContracts.schnoodle) return;
    }

    const contract = artifacts.require(contractName);
    const SchnoodleOld = artifacts.require('SchnoodleV1');

    const proxy = await SchnoodleOld.deployed();

    if (network === 'develop') {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      await upgradeProxy(proxy.address, contract, { deployer });
    } else {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      const contractsFile = require('../scripts/contracts-file.js');
      const address = await prepareUpgrade(proxy.address, contract);

      const proxyAdmin = await admin.getInstance();
      console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
      console.log("Proxy address:", proxy.address);
      console.log("Implementation address:", address);

      contractsFile.append(`${contractName}@${address}`);
    }

    return proxy;
  }
}
