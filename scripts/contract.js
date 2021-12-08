// scripts/contract.js

module.exports = {
  upgrade: async function (deployer, network, contractName, call) {
    const contract = artifacts.require(contractName);
    const Schnoodle = artifacts.require('SchnoodleV1');

    const proxy = await Schnoodle.deployed();

    if (network === 'develop') {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      return await upgradeProxy(proxy.address, contract, { deployer, call, unsafeAllowRenames: true });
    } else {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      const contractsFile = require('../scripts/contracts-file.js');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      const address = await prepareUpgrade(proxy.address, contract, { unsafeAllowRenames: true });

      const proxyAdmin = await admin.getInstance();
      console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
      console.log("Proxy address:", proxy.address);
      console.log("Implementation address:", address);

      contractsFile.append(`${contractName}@${address}`);
    }

    return proxy;
  }
}
