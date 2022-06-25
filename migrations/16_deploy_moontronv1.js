// migrations/16_deploy_moontronv1.js

const { deployProxy, erc1967 } = require('@openzeppelin/truffle-upgrades');
const contractName = 'MoontronV1';

module.exports = async function (deployer, network) {
  //const Schnoodle = artifacts.require('SchnoodleV1');
  //const schnoodle = await Schnoodle.deployed();

  // OpenSea proxy registry addresses for rinkeby and mainnet.
  const proxyRegistryAddress = network === 'rinkeby' ? "0xf57b2c51ded3a29e6891aba85459d600256cf317" : "0xa5409ec958c83c3f309868babaca7c86dcb077c1";

  // Deploy proxy contract
  const Contract = artifacts.require(contractName);
  const instance = await deployProxy(Contract, [proxyRegistryAddress], { deployer });

  // Determine the chain ID for the network being deployed to
  const chainId = { mainnet: 1, rinkeby: 4, chapel: 97, bsc: 56, develop: 1337 }[network];

  // Go through each environment to update the DApp application settings
  for (const env of ['Development', 'Test', 'Production']) {
    const jsonfile = require('jsonfile');
    const file = `SchnoodleDApp/appsettings.${env}.json`;
    let id;

    // Read the settings file, then rebuild it replacing the relevant chain details based on the current deployment
    await jsonfile.writeFile(file, await jsonfile.readFile(file), {spaces: 2, EOL: '\r\n', replacer: (key, value) => {
      if (key == 'Id') id = value;

      if (id === chainId) {
        switch (key) {
          case 'Web3Url': return deployer.provider.host ?? deployer.provider.engine._providers.find(provider => provider._url)?._url ?? deployer.provider.engine._providers.find(provider => provider.rpcUrl).rpcUrl
          case 'MoontronContractAddress': return instance.address;
        }
      }

      return value;
    }});
  }

  if (network === 'develop') {
    return;
  }

  // Transfer ownership of contract to SchnoodleGovernance
  //const SchnoodleGovernance = artifacts.require('SchnoodleGovernance');
  //(await Contract.deployed()).transferOwnership((await SchnoodleGovernance.deployed()).address);

  const { appendList } = require('../scripts/contracts.js');
  appendList(`${contractName}@${await erc1967.getImplementationAddress(instance.address)}`, network);
};
