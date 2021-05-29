// test/SchnoodleTimelock.test.js

const Schnoodle = artifacts.require("Schnoodle");
const SchnoodleTimelock = artifacts.require("SchnoodleTimelock");

const { assert } = require("chai");
const Chance = require("chance");
const truffleAssert = require("truffle-assertions");
const moment = require("moment");

contract("SchnoodleTimelock", accounts => {
  const chance = new Chance();
  const timelockSeconds = 2;
  let schnoodleTimelock;

  beforeEach(async function () {
    beneficiary = chance.pickone(accounts);
    schnoodleTimelock = await SchnoodleTimelock.new((await Schnoodle.deployed()).address, beneficiary, moment().add(timelockSeconds, 'seconds').unix());
  });

  it("should release tokens to the beneficiary after the timelock period", async () => {
    const schnoodle = await Schnoodle.deployed();

    const mintAmount = chance.integer({min: 1});
    const lockAmount = chance.integer({min: 1, max: mintAmount});

    await schnoodle.mint(accounts[0], mintAmount);
    await schnoodle.transfer(schnoodleTimelock.address, lockAmount);

    // Attempt to release tokens before the timelock period
    await truffleAssert.reverts(schnoodleTimelock.release(), "TokenTimelock: current time is before release time");
    assert.equal(0, await schnoodle.balanceOf(await schnoodleTimelock.beneficiary()), "Beneficiary balance is not zero before timelock release");

    await sleep(timelockSeconds * 1000);

    // Attempt to release tokens after the timelock period
    await schnoodleTimelock.release();

    currentBalance = await schnoodle.balanceOf(await schnoodleTimelock.beneficiary());
    assert.approximately(Number(currentBalance), lockAmount, lockAmount * 0.1, "Locked amount wasn't released by the timelock");

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
  });
});
