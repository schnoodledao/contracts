// migrations/5_upgrade_schnoodlev2.js

module.exports = async function (deployer, network) {
  if (network == 'develop') return;
  const { upgrade } = require('../scripts/contracts.js');
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV2');
};
