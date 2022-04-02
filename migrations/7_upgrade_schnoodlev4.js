// migrations/7_upgrade_schnoodlev4.js

module.exports = async function (deployer, network) {
  if (network == 'develop') return;
  const { upgrade } = require('../scripts/contracts.js');
  await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV4');
};
