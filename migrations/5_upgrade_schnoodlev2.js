// migrations/5_upgrade_schnoodlev2.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV2');
};
