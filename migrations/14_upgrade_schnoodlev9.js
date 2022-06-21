// migrations/14_upgrade_schnoodlev9.js

module.exports = async function (deployer, network, accounts) {
  const { upgrade, isProduction } = require('../scripts/contracts.js');
  const schnoodle = await upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV9');

  if (!isProduction(network)) {
    const SchnoodleFarming = artifacts.require('SchnoodleFarmingV1');
    const { bridgeOwner } = require(`../migrations-config.${network}.js`);

    // TODO: Temporary solution until following resolved: https://forum.openzeppelin.com/t/function-invoked-using-call-during-upgrade-process-doesnt-work/18141/5
    // Make the last account a liquidity token to simulate transfers to this account as sells and thus a fee distribution to all other accounts
    await schnoodle.configure(true, accounts[accounts.length - 1], (await SchnoodleFarming.deployed()).address, bridgeOwner);
  }
};
