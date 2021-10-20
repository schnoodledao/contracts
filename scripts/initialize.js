// scripts/initialize.js

module.exports = async function main(callback) {
  try {
    const accounts = await web3.eth.getAccounts();

    const { testContract } = require(`../migrations-config.develop.js`);
    const Schnoodle = artifacts.require(testContract);
    const schnoodle = await Schnoodle.deployed();
    
    stakingPool = accounts[2];
    await schnoodle.changeStaking(stakingPool, 1);
    await schnoodle.transfer(stakingPool, BigInt(400000000000) * BigInt(10 ** 18));

    callback(0);
  } catch (error) {
    console.error(error);
    callback(1);
  }
}
