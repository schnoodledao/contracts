// migrations/12_upgrade_schnoodle_farmingv2.js

module.exports = async function (deployer, network) {
  const { upgrade, isProduction } = require('../scripts/contracts.js');
  const schnoodleFarming = await upgrade(deployer, network, 'SchnoodleFarmingV1', 'SchnoodleFarmingV2');

  if (!isProduction(network)) {
    // TODO: Temporary solution until following resolved: https://forum.openzeppelin.com/t/function-invoked-using-call-during-upgrade-process-doesnt-work/18141/5
    await schnoodleFarming.configure();
  }
};
