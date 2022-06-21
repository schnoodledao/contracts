// migrations/5_upgrade_schnoodlev2.js

module.exports = async function (deployer, network) {
  const { isNew, upgrade } = require('../scripts/contracts.js');
  if (isNew(network)) return;
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV2');
};
