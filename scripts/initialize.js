// scripts/initialize.js

module.exports = async function main(callback) {
  try {
    const bigInt = require('big-integer');
    const accounts = await web3.eth.getAccounts();
    serviceAccount = accounts[0];

    const SchnoodleV1 = artifacts.require("SchnoodleV1");
    const SchnoodleV8 = artifacts.require("SchnoodleV7");
    const schnoodle = new SchnoodleV8((await SchnoodleV1.deployed()).address);
    const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
    
    await schnoodle.changeSowRate(40);
    await schnoodle.changeSellThresholdDetails(BigInt(1 * 10 ** 9) * decimalsFactor, 6);

    // Populate the farming fund for development test purposes
    await schnoodle.transfer(await schnoodle.getFarmingFund(), BigInt(400 * 10 ** 9) * decimalsFactor, { from: serviceAccount });

    // Populate all accounts with some tokens from the service account
    for (const account of accounts) {
      await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(serviceAccount)) / BigInt(accounts.length))), { from: serviceAccount });
    };

    callback(0);
  } catch (error) {
    console.error(error);
    callback(1);
  }
}
