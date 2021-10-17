// scripts/initialize.js

module.exports = async function main(callback) {
  try {
    const accounts = await web3.eth.getAccounts();

    const { testContract } = require(`../migrations-config.develop.js`);
    const Schnoodle = artifacts.require(testContract);
    const schnoodle = await Schnoodle.deployed();
    
    const staking = await schnoodle.staking();
    await schnoodle.transfer(staking[0], BigInt(400000000000) * BigInt(10 ** 18));

    callback(0);
  } catch (error) {
    console.error(error);
    callback(1);
  }
}
