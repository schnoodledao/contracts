// migrations/7_prepare_schnoodlev4.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  contract.upgrade(deployer, network, 'SchnoodleV4');
};
