// scripts/contract.js

module.exports = {
  upgrade: async function (deployer, network, proxyContract, newContract, call) {
    const NewContract = artifacts.require(newContract);
    const ProxyContract = artifacts.require(proxyContract);

    const proxy = await ProxyContract.deployed();

    if (network === 'develop') {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      return await upgradeProxy(proxy.address, NewContract, { deployer, call, unsafeAllowRenames: true });
    } else {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      const contractsFile = require('../scripts/contracts-file.js');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      const address = await prepareUpgrade(proxy.address, NewContract, { unsafeAllowRenames: true });

      const proxyAdmin = await admin.getInstance();
      console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
      console.log("Proxy address:", proxy.address);
      console.log("Implementation address:", address);

      contractsFile.append(`${newContract}@${address}`);
    }

    return proxy;
  }
}
