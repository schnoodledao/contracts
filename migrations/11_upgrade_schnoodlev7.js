// migrations/11_upgrade_schnoodlev7.js

module.exports = async function (deployer, network, accounts) {
  const { isNew, upgrade } = require('../scripts/contracts.js');
  if (isNew(network)) return;
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV7');
};
