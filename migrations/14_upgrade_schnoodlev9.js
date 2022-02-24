// migrations/14_upgrade_schnoodlev9.js

module.exports = async function (deployer, network, accounts) {
  const contract = require('../scripts/contract.js');
  const schnoodle = await contract.upgrade(deployer, network, 'SchnoodleV1', 'SchnoodleV9');

  // TODO: Temporary solution until following resolved: https://forum.openzeppelin.com/t/function-invoked-using-call-during-upgrade-process-doesnt-work/18141/5
  if (network == 'develop') {
    const SchnoodleFarming = artifacts.require('SchnoodleFarmingV1');

    // Make the last account a liquidity token to simulate transfers to this account as sells and thus a fee distribution to all other accounts
    await schnoodle.configure(true, accounts[accounts.length - 1], (await SchnoodleFarming.deployed()).address);
  }
};