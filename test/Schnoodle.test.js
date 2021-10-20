// test/Schnoodle.test.js

const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const [ serviceAccount, stakingPool, eleemosynary ] = accounts;
const { BN, singletons, time } = require('@openzeppelin/test-helpers');

const { testContract } = require(`../migrations-config.develop.js`);
const Schnoodle = contract.fromArtifact(testContract);

const { assert } = require('chai');
require('chai').should();
const Chance = require('chance');
const bigInt = require('big-integer')
const truffleAssert = require('truffle-assertions');

const chance = new Chance();
let schnoodle;
let initialTokens;
let feePercent;
let donationPercent;
let stakingPercent;

const data = web3.utils.sha3(chance.string());

beforeEach(async function () {
  initialTokens = chance.integer({ min: 1000 });
  feePercent = chance.integer({ min: 1, max: 20 });
  donationPercent = chance.integer({ min: 1, max: 20 });
  stakingPercent = chance.integer({ min: 1, max: 20 });

  await singletons.ERC1820Registry(serviceAccount);

  schnoodle = await Schnoodle.new();
  await schnoodle.initialize(initialTokens, serviceAccount);
  await schnoodle.changeFeePercent(feePercent);
  await schnoodle.changeEleemosynary(eleemosynary, donationPercent);
  await schnoodle.changeStaking(stakingPool, stakingPercent);
});

describe('Balance', () => {
  it('should show an initial balance of the initial supply for the service account', async () => {
    assert.equal(await schnoodle.balanceOf(serviceAccount), initialTokens * 10 ** await schnoodle.decimals(), `Account ${serviceAccount} doesn't have a balance equal to the initial supply`);
  });

  it('should show an initial balance of zero for all non-service accounts', async () => {
    for (const account of accounts) {
      if (account != serviceAccount) {
        (await schnoodle.balanceOf(account)).should.be.bignumber.equal(new BN(0), `Account ${account} doesn't have a zero balance`);
      }
    }
  });
});

describe("Burning", () => {
  it("should burn tokens decreasing the account's balance and total supply by the same amounts", async () => {
    await _testBurning(BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(serviceAccount)))));
  });

  it("should revert on attempt to burn more tokens than are available", async () => {
    // Pre-burn a token to prevent an overflow error on the reflected amount during the test burn
    await schnoodle.burn(1, data, { from: serviceAccount });
    await truffleAssert.reverts(_testBurning(BigInt(await schnoodle.balanceOf(serviceAccount)) + BigInt(1)), "ERC777: burn amount exceeds balance");
  });

  async function _testBurning(amount) {
    const totalSupply = BigInt(await schnoodle.totalSupply());
    const balance = BigInt(await schnoodle.balanceOf(serviceAccount));
    
    await schnoodle.burn(amount, data, { from: serviceAccount });

    const newTotalSupply = BigInt(await schnoodle.totalSupply());
    assert.equal(newTotalSupply, totalSupply - amount, "Total supply wasn't affected correctly by burning");

    const newBalance = BigInt(await schnoodle.balanceOf(serviceAccount));
    assert.equal(newBalance, balance - amount, "Service account wasn't affected correctly by burning");
  }
});

describe('Transfer', () => {
  it('should transfer some ERC-20 tokens to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => _transfer(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-20 tokens to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => _transfer(schnoodle, sender, recipient, amount));
  });

  it('should transfer some ERC-20 tokens from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => _transferFrom(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-20 tokens from the sender to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => _transferFrom(schnoodle, sender, recipient, amount));
  });

  it('should transfer some ERC-777 tokens to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => _send(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-777 tokens to the recipient and distribute a fee to all accounts', async() => {
    await _testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => _send(schnoodle, sender, recipient, amount));
  });

  async function _transfer(schnoodle, sender, recipient, amount) {
    await schnoodle.transfer(recipient, amount, {from: sender});
  }

  async function _transferFrom(schnoodle, sender, recipient, amount) {
    await schnoodle.approve(sender, amount, {from: sender});
    assert.equal(amount, BigInt(await schnoodle.allowance(sender, sender)));
    await schnoodle.transferFrom(sender, recipient, amount, {from: sender});
  }

  async function _send(schnoodle, sender, recipient, amount) {
    await schnoodle.send(recipient, amount, 0, {from: sender});
  }

  async function _testTransfer(amountCallback, transferCallback) {
    await _populateAccounts();

    let amounts = {};
    for (const account of accounts) {
      amounts[account] = BigInt(await schnoodle.balanceOf(account));
    }

    // Randomly pick different sender and recipient accounts ensuring they're not the eleemosynary account
    senderCandidates = accounts.filter(a => a != eleemosynary);
    sender = chance.pickone(senderCandidates);
    recipient = chance.pickone(senderCandidates.filter(a => a != sender));

    // Invoke the callback function to get the desired amount to transfer for this test
    const transferAmount = amountCallback(BigInt(await schnoodle.balanceOf(sender)));

    await transferCallback(schnoodle, sender, recipient, transferAmount);

    let totalBalance = BigInt(0);

    // Check the balances of all accounts to ensure they match the expected algorithm
    for (const account of accounts) {
      const oldAmount = amounts[account];

      // Determine the percent change from the old amount depending on whether the account is the sender (down), recipient (up), eleemosynary (up) or other (zero)
      const deltaPercent = account == sender
        ? -100
        : (account == recipient
          ? 100 - feePercent - donationPercent - stakingPercent
          : (account == eleemosynary
            ? donationPercent - feePercent / 10 // A fee is also paid on the donation itself
            : 0));

      // The old amount is adjusted by a percentage of the transfer amount depending on the account role in the transfer (sender, recipient, eleemosynary or other)
      const baseBalance = oldAmount + transferAmount * BigInt(deltaPercent * 10) / BigInt(1000);

      // The expected balance should include a distribution of the fees, and therefore be higher than the base balance
      const newBalance = BigInt(await schnoodle.balanceOf(account));

      totalBalance += newBalance;

      const accountRole = account == sender ? 'sender' : (account == recipient ? 'recipient' : (account == eleemosynary ? 'eleemosynary' : ''));
      assert.isTrue(newBalance >= baseBalance, `Account ${account}${accountRole == '' ? '' : (` (${accountRole})`)} incorrect after transfer`);
    }

    assert.isTrue(totalBalance - BigInt(await schnoodle.totalSupply()) < 1, 'Total of all balances doesn\'t match total supply');
  }
});

describe('Staking', () => {
  let stakeholder;
  let stakeAmount;
  let startBalance;

  beforeEach(async function () {
    await _populateAccounts();
    stakeholderCandidates = accounts.filter(a => a != stakingPool);
    stakeholder = chance.pickone(stakeholderCandidates);
    stakeAmount = BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(stakeholder))));
    startBalance = BigInt(await schnoodle.balanceOf(stakeholder));
  });

  it('should increase the stakeholder\'s balance by a nonzero reward when a stake with 1 lock block is withdrawn', async() => {
    await schnoodle.addStake(stakeAmount, 1, { from: stakeholder });
    await time.advanceBlock();
    const receipt = await schnoodle.withdrawStake(0, stakeAmount, { from: stakeholder });
    const reward = BigInt(receipt.logs.find(l => l.event == 'Withdrawn').args.reward);
    assert.isTrue(reward > 0n, 'Staking reward is not positive');
    assert.equal(BigInt(await schnoodle.balanceOf(stakeholder)), startBalance + reward, 'Stakeholder balance wasn\'t increased by the reward amount');
  });

  it('should not increase the stakeholder\'s balance when a stake with no lock blocks is withdrawn', async() => {
    await schnoodle.addStake(stakeAmount, 0, { from: stakeholder });
    await time.advanceBlock();
    const receipt = await schnoodle.withdrawStake(0, stakeAmount, { from: stakeholder });
    const reward = BigInt(receipt.logs.find(l => l.event == 'Withdrawn').args.reward);
    assert.isTrue(reward == 0n, 'Staking reward is not zero');
    assert.equal(BigInt(await schnoodle.balanceOf(stakeholder)), startBalance + reward, 'Stakeholder balance was wrongly increased');
  });

  it('should revert on attempt to withdraw during lock blocks', async() => {
    await schnoodle.addStake(stakeAmount, chance.integer({ min: 1 }), { from: stakeholder });
    await truffleAssert.reverts(schnoodle.withdrawStake(0, stakeAmount, { from: stakeholder }), "Stakeable: cannot withdraw during lock blocks");
  });

  it('should revert on attempt to stake more tokens than are unstaked', async() => {
    await schnoodle.addStake(stakeAmount, 0, { from: stakeholder });
    const additionalStake = BigInt(bigInt.randBetween(startBalance - stakeAmount + BigInt(1), startBalance));
    await truffleAssert.reverts(schnoodle.addStake(additionalStake, 0, { from: stakeholder }), "Stakeable: stake amount exceeds unstaked balance");
  });

  it('should revert on attempt to transfer more tokens than are unstaked', async() => {
    await schnoodle.addStake(stakeAmount, 0, { from: stakeholder });
    const transferAmount = BigInt(bigInt.randBetween(startBalance - stakeAmount + BigInt(1), startBalance));
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, transferAmount, { from: stakeholder }), "Schnoodle: transfer amount exceeds unstaked balance");
  });

  it('should revert on attempt to transfer more tokens than are available including staked', async() => {
    await schnoodle.addStake(stakeAmount, 0, { from: stakeholder });
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, BigInt(startBalance + BigInt(1)), { from: stakeholder }), "ERC777: transfer amount exceeds balance");
  });
});

async function _populateAccounts() {
  // Populate all accounts with some tokens from the service account
  for (const account of accounts) {
    await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(serviceAccount)) / BigInt(accounts.length))), { from: serviceAccount });
  };
}
