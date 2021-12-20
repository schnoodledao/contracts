// migrations/11_upgrade_schnoodlev7.js

module.exports = async function (deployer, network, accounts) {
  if (network == 'develop') return;
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV7');
};
