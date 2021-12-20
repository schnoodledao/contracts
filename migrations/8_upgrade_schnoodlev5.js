// migrations/8_upgrade_schnoodlev5.js

module.exports = async function (deployer, network) {
  if (network == 'develop') return;
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV5');
};
