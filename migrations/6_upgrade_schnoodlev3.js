// migrations/6_upgrade_schnoodlev3.js

module.exports = async function (deployer, network) {
  const { isNew, upgrade } = require('../scripts/contracts.js');
  if (isNew(network)) return;
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV3');
};
