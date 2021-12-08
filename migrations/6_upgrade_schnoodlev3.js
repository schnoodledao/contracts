// migrations/6_upgrade_schnoodlev3.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV3');
};
