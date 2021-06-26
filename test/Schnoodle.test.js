// test/Schnoodle.test.js

const { accounts, contract } = require('@openzeppelin/test-environment');
const [ owner ] = accounts;
const { BN } = require('@openzeppelin/test-helpers');

const Schnoodle = contract.fromArtifact('SchnoodleV1');

const { initialization } = require('../migrations-config.js');
const { assert } = require('chai');
require('chai').should();
const Chance = require('chance');
const bigInt = require('big-integer')
const truffleAssert = require('truffle-assertions');

const chance = new Chance();
let schnoodle;

beforeEach(async function () {
  schnoodle = await Schnoodle.new();
  await schnoodle.initialize(initialization.initialTokens, owner, initialization.feePercent);
});

describe('Balance', () => {
  it('should show an initial balance of the initial supply for the owner account', async () => {
    assert.equal(await schnoodle.balanceOf(owner), initialization.initialTokens * 10 ** await schnoodle.decimals(), `Account ${owner} doesn't have a balance equal to the initial supply`);
  });

  it('should show an initial balance of zero for all non-owner accounts', async () => {
    for (const account of accounts) {
      if (account != owner) {
        (await schnoodle.balanceOf(account)).should.be.bignumber.equal(new BN(0), `Account ${account} doesn't have a zero balance`);
      }
    }
  });
});

describe("Burning", () => {
  it("should burn tokens decreasing the account's balance and total supply by the same amounts", async () => {
    await _testBurning(BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(owner)))));
  });

  it("should revert on attempt to burn more tokens than are available", async () => {
    // Pre-burn a token to prevent an overflow error on the reflected amount during the test burn
    await schnoodle.burn(1, { from: owner })
    await truffleAssert.reverts(_testBurning(BigInt(await schnoodle.balanceOf(owner)) + BigInt(1)), "ERC20: burn amount exceeds balance")
  });

  async function _testBurning(amount) {
    const totalSupply = BigInt(await schnoodle.totalSupply());
    const balance = BigInt(await schnoodle.balanceOf(owner));
    
    await schnoodle.burn(amount, { from: owner });

    const newTotalSupply = BigInt(await schnoodle.totalSupply());
    assert.equal(newTotalSupply, totalSupply - amount, "Total supply wasn't affected correctly by burning");

    const newBalance = BigInt(await schnoodle.balanceOf(owner));
    assert.equal(newBalance, balance - amount, "Owner's account wasn't affected correctly by burning");
  }
});

describe('Transfer', () => {
  it('should transfer from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => BigInt(bigInt.randBetween(1, amount)));
  });

  it('should transfer all from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => amount);
  });

  async function _testTransfer(transferAmountCallback) {
    // Populate all accounts with some tokens from the owner account
    for (const account of accounts) {
      await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(owner)) / BigInt(accounts.length))), { from: owner });
    };

    let amounts = {};
    for (const account of accounts) {
      amounts[account] = BigInt(await schnoodle.balanceOf(account));
    }

    sender = chance.pickone(accounts);
    recipient = chance.pickone(accounts);

    // Invoke the callback function to get the desired transfer amount to send for this test
    const transferAmount = transferAmountCallback(BigInt(await schnoodle.balanceOf(sender)));

    await schnoodle.transfer(recipient, transferAmount, {from: sender});

    let totalBalance = BigInt(0);

    // Check the balances of all accounts to ensure they match the expected algorithm
    for (const account of accounts) {
      const oldAmount = amounts[account];

      // The old amount is adjusted by the transfer amount for only the sender (down) and recipient (up), less the fee for the latter
      const baseBalance = oldAmount + transferAmount * BigInt(account == sender ? -100 : (account == recipient ? 100 - initialization.feePercent : 0)) / BigInt(100);

      // The expected balance should include a distribution of the fees, and therefore be higher than the base balance
      const newBalance = BigInt(await schnoodle.balanceOf(account));

      totalBalance += newBalance;

      // Chai doesn't fully suppport BigInt yet, so perform and approximate assertion this way
      assert.isTrue(newBalance >= baseBalance, `Account ${account}${account == sender ? ' (sender)' : (account == recipient ? ' (recipient)' : '')} incorrect after transfer`);
    }

    assert.isTrue(totalBalance - BigInt(await schnoodle.totalSupply()) < 1, 'Total of all balances doesn\'t match total supply');
  }
});
