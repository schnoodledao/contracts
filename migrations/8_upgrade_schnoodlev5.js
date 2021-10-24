// migrations/8_upgrade_schnoodlev5.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV5');
};
