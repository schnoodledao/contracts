// migrations/9_upgrade_schnoodlev6.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  await contract.upgrade(deployer, network, 'SchnoodleV6');
};
