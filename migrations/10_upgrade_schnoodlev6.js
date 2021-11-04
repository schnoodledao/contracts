// migrations/10_upgrade_schnoodlev6.js

module.exports = async function (deployer, network) {
  const contract = require('../scripts/contract.js');
  const proxy = await contract.upgrade(deployer, network, 'SchnoodleV6');

  // TODO: Temporary solution until following resolved: https://forum.openzeppelin.com/t/function-invoked-using-call-during-upgrade-process-doesnt-work/18141/5
  if (network == 'develop') {
    const SchnoodleStaking = artifacts.require('SchnoodleStakingV1');
    await proxy.upgrade((await SchnoodleStaking.deployed()).address);
  }
};
