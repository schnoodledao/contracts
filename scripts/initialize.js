// scripts/initialize.js

module.exports = async function main(callback) {
  try {
    const accounts = await web3.eth.getAccounts();

    const SchnoodleV1 = artifacts.require("SchnoodleV1");
    const SchnoodleV7 = artifacts.require("SchnoodleV7");
    const proxy = new SchnoodleV7((await SchnoodleV1.deployed()).address);
    
    await proxy.changeStakingRate(10);

    // Populate the staking fund for development test purposes
    await proxy.transfer(await proxy.stakingFund(), BigInt(400000000000) * BigInt(10 ** 18));

    callback(0);
  } catch (error) {
    console.error(error);
    callback(1);
  }
}
