// migrations/5_prepare_schnoodlev2.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  contract.upgrade(deployer, network, 'SchnoodleV2');
};
