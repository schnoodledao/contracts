// scripts/contracts.js

module.exports = {
  upgrade: async function (deployer, network, proxyContract, newContract, call) {
    const NewContract = artifacts.require(newContract);
    const ProxyContract = artifacts.require(proxyContract);

    const proxy = await ProxyContract.deployed();

    if (module.exports.isProduction(network)) {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      const address = await prepareUpgrade(proxy.address, NewContract, { unsafeAllowRenames: true });

      const proxyAdmin = await admin.getInstance();
      console.log("Write 'upgrade' at ProxyAdmin address:", proxyAdmin.address);
      console.log("Proxy address:", proxy.address);
      console.log("Implementation address:", address);

      module.exports.appendList(`${newContract}@${address}`, network);
    } else {
      const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      return await upgradeProxy(proxy.address, NewContract, { deployer, call, unsafeAllowRenames: true });
    }

    return proxy;
  },

  appendList: (contractName, network) => {
    const fs = require('fs');
    const os = require("os");

    fs.appendFile(`./contracts-${network}.txt`, contractName + os.EOL, (err) => {
      if (err) {
         console.log(err);
      }
    });
  },

  isProduction: (network) => {
    return ['mainnet', 'bsc'].includes(network);
  }
}
