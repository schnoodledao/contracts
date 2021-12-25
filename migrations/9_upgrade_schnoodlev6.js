// migrations/9_upgrade_schnoodlev6.js

module.exports = async function (deployer, network) {
  if (network == 'develop') return;
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV6');
};
