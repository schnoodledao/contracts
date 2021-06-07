// test/Schnoodle.test.js

const { accounts, contract } = require('@openzeppelin/test-environment');
const [ owner ] = accounts;
const { BN } = require('@openzeppelin/test-helpers');

const Schnoodle = contract.fromArtifact('Schnoodle');

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

describe('Transfer', () => {
  it('should transfer from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => BigInt(bigInt.randBetween(1, amount)));
  });

  it('should transfer all from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => amount);
  });

  it('should revert on attempt to transfer without enough balance', async() => {
    await truffleAssert.reverts(_testTransfer(amount => amount * BigInt(2)), 'Schnoodle: transfer amount exceeds balance')
  });

  async function _testTransfer(transferAmountCallback) {
    // Populate all accounts with some tokens from the owner account
    for (const account of accounts) {
      await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(owner)) / BigInt(accounts.length))), { from: owner });
    };

    let amounts = {};
    for (const account of accounts) {
      amounts[account] = BigInt(await schnoodle.balanceOfBurnable(account));
    }

    sender = chance.pickone(accounts);
    recipient = chance.pickone(accounts);

    const senderBalance = BigInt(await schnoodle.balanceOf(sender));

    // Invoke the callback function to get the desired transfer amount to send for this test
    const transferAmount = transferAmountCallback(senderBalance);

    // Capture the fee part of the sender's balance before transfer as this is used up first in the transfer, and must be factored into the assert algorithm later
    const balanceFee = senderBalance - BigInt(await schnoodle.balanceOfBurnable(sender));

    await schnoodle.approve(sender, transferAmount, {from: sender});
    await schnoodle.transfer(recipient, transferAmount, {from: sender});

    const totalFees = BigInt(await schnoodle.totalFees());
    const totalSupply = BigInt(await schnoodle.totalSupply());

    // Check the balances of all accounts to ensure they match the expected algorithm
    for (const account of accounts) {
      const oldAmount = amounts[account];

      // Sender's old amount is reduced by the transfer amount less the fee part of the account's balance; recipient's is increased by the transfer amount
      const newAmount = oldAmount + transferAmount * BigInt(account == sender ? -100 : (account == recipient ? 100 - initialization.feePercent : 0)) / BigInt(100) + (account == sender ? balanceFee : BigInt(0));

      // The expected balance should also include a distribution of the total fees in proportion to the total supply
      const expectedBalance = newAmount + newAmount * totalFees / (totalSupply - totalFees);
      const newBalance = BigInt(await schnoodle.balanceOf(account));

      // Chai doesn't fully suppport BigInt yet, so perform and approximate assertion this way
      assert.isTrue(newBalance - expectedBalance <= 1, `Account ${account}${account == sender ? ' (sender)' : (account == recipient ? ' (recipient)' : '')} incorrect after transfer`);
    }
  }
});
