// migrations/14_upgrade_schnoodlev9.js

module.exports = async function (deployer, network) {
  const { isNew, upgrade } = require('../scripts/contracts.js');
  if (isNew(network)) return;
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV9');
};
