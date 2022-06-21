// migrations/7_upgrade_schnoodlev4.js

module.exports = async function (deployer, network) {
  const { isNew, upgrade } = require('../scripts/contracts.js');
  if (isNew(network)) return;
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV4');
};
