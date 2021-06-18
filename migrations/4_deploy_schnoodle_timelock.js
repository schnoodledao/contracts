// migrations/4_deploy_schnoodle_timelock.js

const contractsFile = require('../scripts/contracts-file.js');

const contractName = 'SchnoodleTimelock';
const SchnoodleTimelock = artifacts.require(contractName);

module.exports = async function (deployer) {
  await deployer.deploy(SchnoodleTimelock);

  contractsFile.append(contractName);
};
