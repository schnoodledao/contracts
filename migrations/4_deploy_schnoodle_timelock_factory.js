// migrations/4_deploy_schnoodle_timelock_factory.js

const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleTimelockFactory';
const SchnoodleTimelockFactory = artifacts.require(contractName);

module.exports = async function (deployer, network) {
  if (network === 'develop') return;

  await deployer.deploy(SchnoodleTimelockFactory);

  contractsFile.append(contractName);
};
