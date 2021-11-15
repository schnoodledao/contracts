// scripts/contract.js

module.exports = {
  upgrade: async function (deployer, network, contractName, call) {
    const contract = artifacts.require(contractName);
    const Schnoodle = artifacts.require('SchnoodleV1');

    const proxy = await Schnoodle.deployed();

    if (network === 'develop') {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      return await upgradeProxy(proxy.address, contract, { deployer, call, unsafeAllowRenames: true });
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
