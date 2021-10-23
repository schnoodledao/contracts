// migrations/6_prepare_schnoodlev3.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  contract.upgrade(deployer, network, 'SchnoodleV3');
};
