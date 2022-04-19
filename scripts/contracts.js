// scripts/contracts.js

module.exports = {
  upgrade: async function (deployer, network, proxyContract, newContract, call) {
    const NewContract = artifacts.require(newContract);
    const ProxyContract = artifacts.require(proxyContract);

    const instance = await ProxyContract.deployed();
    let address;

    if (module.exports.isProduction(network)) {
      const { prepareUpgrade, admin } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      address = await prepareUpgrade(instance.address, NewContract, { unsafeAllowRenames: true });

      const instanceAdmin = await admin.getInstance();
      module.exports.appendList(`${newContract}@${address}`, network);

      console.log("Write 'upgrade' at ProxyAdmin address:", instanceAdmin.address);
      console.log("Proxy address:", instance.address);
      console.log("Implementation address:", address);

      return instance;
    } else {
      const { upgradeProxy, erc1967 } = require('@openzeppelin/truffle-upgrades');
      // Use unsafeAllowRenames until resolved: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/73#issuecomment-968532028
      const upgraded = await upgradeProxy(instance.address, NewContract, { deployer, call, unsafeAllowRenames: true });
      module.exports.appendList(`${newContract}@${await erc1967.getImplementationAddress(upgraded.address)}`, network);

      return upgraded;
    }
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
