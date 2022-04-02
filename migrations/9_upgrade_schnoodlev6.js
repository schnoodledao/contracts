// migrations/9_upgrade_schnoodlev6.js

module.exports = async function (deployer, network) {
  if (network == 'develop') return;
  const { upgrade } = require('../scripts/contracts.js');
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV6');
};
