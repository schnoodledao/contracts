// test/SchnoodleTimelock.test.js

const { accounts, contract } = require('@openzeppelin/test-environment');
const [ owner ] = accounts;
const { BN } = require('@openzeppelin/test-helpers');

const Schnoodle = contract.fromArtifact('SchnoodleV1');
const SchnoodleTimelock = contract.fromArtifact('SchnoodleTimelock');

const { initialization } = require('../migrations-config.js');
const { assert } = require('chai');
require('chai').should();
const Chance = require('chance');
const bigInt = require('big-integer')
const truffleAssert = require('truffle-assertions');
const moment = require('moment');

const chance = new Chance();
const timelockSeconds = 2;
let schnoodle;
let schnoodleTimelock;

beforeEach(async function () {
  schnoodle = await Schnoodle.new();
  await schnoodle.initialize(initialization.initialTokens, owner);
  schnoodleTimelock = await SchnoodleTimelock.new();
  await schnoodleTimelock.initialize(schnoodle.address, chance.pickone(accounts), moment().add(timelockSeconds, 'seconds').unix());
});

it('should release tokens to the beneficiary after the timelock period', async () => {
  const lockAmount = BigInt(bigInt.randBetween(1, initialization.initialTokens * 10 ** await schnoodle.decimals()));

  await schnoodle.transfer(schnoodleTimelock.address, lockAmount, { from: owner });

  // Attempt to release tokens before the timelock period
  await truffleAssert.reverts(schnoodleTimelock.release(), 'TokenTimelock: current time is before release time');
  (await schnoodle.balanceOf(await schnoodleTimelock.beneficiary())).should.be.bignumber.equal(new BN(0), 'Beneficiary balance is not zero before timelock release');

  await sleep(timelockSeconds * 1000);

  // Attempt to release tokens after the timelock period
  await schnoodleTimelock.release();

  currentBalance = BigInt(await schnoodle.balanceOf(await schnoodleTimelock.beneficiary()));
  assert.isTrue(currentBalance - lockAmount < lockAmount * BigInt(10) / BigInt(100), 'Locked amount wasn\'t released by the timelock');

  function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }
});
