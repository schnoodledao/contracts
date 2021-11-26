// test/Schnoodle.test.js

const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const [ serviceAccount, eleemosynary ] = accounts;
const { BN, singletons, time } = require('@openzeppelin/test-helpers');

const { testContracts } = require(`../migrations-config.develop.js`);

const { assert } = require('chai');
require('chai').should();
const Chance = require('chance');
const bigInt = require('big-integer');
const truffleAssert = require('truffle-assertions');

const chance = new Chance();
let schnoodle;
let schnoodleStaking;
let initialTokens;

const data = web3.utils.sha3(chance.string());

beforeEach(async function () {
  initialTokens = chance.integer({ min: 1000 });

  await singletons.ERC1820Registry(serviceAccount);
  const Schnoodle = contract.fromArtifact(testContracts.schnoodle);
  const SchnoodleStaking = contract.fromArtifact(testContracts.schnoodleStaking);

  schnoodle = await Schnoodle.new();
  await schnoodle.methods['initialize(uint256,address)'](initialTokens, serviceAccount, { from: serviceAccount });

  schnoodleStaking = await SchnoodleStaking.new();
  await schnoodleStaking.initialize(schnoodle.address);
  await schnoodle.configure(true, serviceAccount, schnoodleStaking.address, { from: serviceAccount });
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

  it("should burn all tokens reducing account's balance and total supply to zero", async () => {
    await _testBurning(BigInt(await schnoodle.balanceOf(serviceAccount)));
    assert.equal(await schnoodle.balanceOf(serviceAccount), 0, "Total supply wasn't reduced to zero by burning");
  });

  it("should revert on attempt to burn more tokens than are available", async () => {
    // Pre-burn a token to prevent an overflow error on the reflected amount during the test burn
    await schnoodle.burn(1, data, { from: serviceAccount });
    await truffleAssert.reverts(_testBurning(BigInt(await schnoodle.balanceOf(serviceAccount)) + 1n), "ERC777: burn amount exceeds balance");
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
  let amounts;
  let senderCandidates;
  let sender;
  let recipient;
  let feeRate;
  let donationRate;
  let stakingRate;

  beforeEach(async function () {
    feeRate = chance.integer({ min: 10, max: 200 });
    donationRate = chance.integer({ min: 10, max: 200 });
    stakingRate = chance.integer({ min: 10, max: 200 });

    await schnoodle.changeFeeRate(feeRate, { from: serviceAccount });
    await schnoodle.changeEleemosynary(eleemosynary, donationRate, { from: serviceAccount });
    await schnoodle.changeStakingRate(stakingRate, { from: serviceAccount });
    await _populateAccounts();

    amounts = {};
    for (const account of accounts) {
      amounts[account] = BigInt(await schnoodle.balanceOf(account));
    }

    // Randomly pick different sender and recipient accounts for performing the transfer test
    senderCandidates = accounts.filter(a => a != eleemosynary);
    sender = chance.pickone(senderCandidates);
    recipient = chance.pickone(senderCandidates.filter(a => a != sender));

    // Class the test transfer as a sell to test the fee distribution algorithm
    await schnoodle.grantRole(await schnoodle.LIQUIDITY(), recipient, { from: serviceAccount });
  });

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
    // Invoke the callback function to get the desired amount to transfer for this test
    const transferAmount = amountCallback(BigInt(await schnoodle.balanceOf(sender)));

    await transferCallback(schnoodle, sender, recipient, transferAmount);

    let totalBalance = 0n;

    // Check the balances of all accounts to ensure they match the expected algorithm
    for (const account of accounts) {
      const oldAmount = amounts[account];

      // Determine the rate change from the old amount depending on whether the account is the sender (down), recipient (up), eleemosynary (up) or other (zero)
      const deltaRate = account == sender
        ? -1000
        : (account == recipient
          ? 1000 - feeRate - donationRate - stakingRate
          : (account == eleemosynary
            ? donationRate
            : 0));

      // The old amount is adjusted by a fraction of the transfer amount depending on the account role in the transfer (sender, recipient, eleemosynary or other)
      const baseBalance = oldAmount + transferAmount * BigInt(deltaRate) / 1000n;

      // The expected balance should include a distribution of the fees, and therefore be higher than the base balance
      const newBalance = BigInt(await schnoodle.balanceOf(account));

      totalBalance += newBalance;

      const accountRole = account == sender ? 'sender' : (account == recipient ? 'recipient' : (account == eleemosynary ? 'eleemosynary' : ''));
      const accountIdentity = `${account}${accountRole == '' ? '' : (` (${accountRole})`)}`;
      assert.isTrue(newBalance >= baseBalance, `Account ${accountIdentity} balance incorrect after transfer`);

      // Check that fee distribution took place on all accounts but those involved in the transfer
      if (account != sender && account != recipient) {
        const {1: deltaBalance} = await schnoodle.reflectTrackerInfo(account);
        assert.isTrue(BigInt(deltaBalance) > 0n, `Account ${accountIdentity} delta balance is zero`);
      }
    }

    assert.isTrue(totalBalance - BigInt(await schnoodle.totalSupply()) < 1, 'Total of all balances doesn\'t match total supply');
  }
});

describe('Staking', () => {
  let stakeholder;
  let stakeAmount;
  let vestingBlocks;
  let unbondingBlocks;
  let stakingFund;
  let stakeholderStartBalance;
  let stakingFundStartBalance;

  beforeEach(async function () {
    await schnoodle.changeStakingRate(chance.integer({ min: 10, max: 200 }), { from: serviceAccount });

    await _populateAccounts();
    stakingFund = await schnoodle.stakingFund();
    await schnoodle.transfer(stakingFund, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(serviceAccount)))), { from: serviceAccount });
    stakeholder = chance.pickone(accounts);
    stakeAmount = BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(stakeholder))));
    vestingBlocks = chance.integer({ min: 1, max: 20 });
    unbondingBlocks = chance.integer({ min: 1, max: 20 });
    stakeholderStartBalance = BigInt(await schnoodle.balanceOf(stakeholder));
    stakingFundStartBalance = BigInt(await schnoodle.balanceOf(stakingFund));
  });

  it('should increase the stakeholder\'s balance by a nonzero reward when a stake with finite vesting blocks and unbonding blocks is withdrawn', async() => {
    [netReward, grossReward] = await addStakeAndWithdraw(vestingBlocks, unbondingBlocks);

    assert.isTrue(netReward > 0n && grossReward > 0n, 'Staking reward value is not positive');
    assert.equal(BigInt(await schnoodle.balanceOf(stakeholder)), stakeholderStartBalance + netReward, 'Stakeholder balance wasn\'t increased by the net reward amount');
    assert.equal(BigInt(await schnoodle.balanceOf(stakingFund)), stakingFundStartBalance - grossReward, 'Staking fund wasn\'t reduced by the gross reward amount');
  });

  it('should revert on attempt to stake with zero stake amount', async() => {
    await truffleAssert.reverts(schnoodleStaking.addStake(0, vestingBlocks, unbondingBlocks, { from: stakeholder }), "SchnoodleStaking: Stake amount must be greater than zero");
  });

  it('should revert on attempt to stake with zero vesting blocks', async() => {
    await truffleAssert.reverts(schnoodleStaking.addStake(stakeAmount, 0, unbondingBlocks, { from: stakeholder }), "SchnoodleStaking: Vesting blocks must be greater than zero");
  });

  it('should revert on attempt to stake with zero unbonding blocks', async() => {
    await truffleAssert.reverts(schnoodleStaking.addStake(stakeAmount, vestingBlocks, 0, { from: stakeholder }), "SchnoodleStaking: Unbonding blocks must be greater than zero");
  });

  it('should revert on attempt to withdraw during vesting blocks', async() => {
    await schnoodleStaking.addStake(stakeAmount, vestingBlocks, unbondingBlocks, { from: stakeholder });
    await truffleAssert.reverts(schnoodleStaking.withdraw(0, 0, stakeAmount, { from: stakeholder }), "SchnoodleStaking: cannot withdraw during vesting blocks");
  });

  it('should revert on attempt to stake more tokens than are unstaked', async() => {
    await schnoodleStaking.addStake(stakeAmount, vestingBlocks, unbondingBlocks, { from: stakeholder });
    const additionalStake = BigInt(bigInt.randBetween(stakeholderStartBalance - stakeAmount + 1n, stakeholderStartBalance));
    await truffleAssert.reverts(schnoodleStaking.addStake(additionalStake, vestingBlocks, unbondingBlocks, { from: stakeholder }), "SchnoodleStaking: stake amount exceeds unstaked balance");
  });

  it('should revert on attempt to transfer more tokens than are unstaked', async() => {
    await schnoodleStaking.addStake(stakeAmount, vestingBlocks, unbondingBlocks, { from: stakeholder });
    const transferAmount = BigInt(bigInt.randBetween(stakeholderStartBalance - stakeAmount + 1n, stakeholderStartBalance));
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, transferAmount, { from: stakeholder }), "Schnoodle: transfer amount exceeds unstaked balance");
  });

  it('should revert on attempt to transfer more tokens than are available including staked', async() => {
    await schnoodleStaking.addStake(stakeAmount, vestingBlocks, unbondingBlocks, { from: stakeholder });
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, BigInt(stakeholderStartBalance + 1n), { from: stakeholder }), "ERC777: transfer amount exceeds balance");
  });

  async function addStakeAndWithdraw(vestingBlocks, unbondingBlocks) {
    await schnoodleStaking.addStake(stakeAmount, vestingBlocks, unbondingBlocks, { from: stakeholder });

    Array.from({length: vestingBlocks}, async () => await time.advanceBlock());

    const receipt = await schnoodleStaking.withdraw(0, 0, stakeAmount, { from: stakeholder });

    let withdrawnEvent = receipt.logs.find(l => l.event == 'Withdrawn');
    return [BigInt(withdrawnEvent.args.netReward), BigInt(withdrawnEvent.args.grossReward)];
  }
});

describe('Reflect Tracker', () => {
  let sender;

  beforeEach(async function () {
    await _populateAccounts();

    sender = chance.pickone(accounts);
    recipient = chance.pickone(accounts.filter(a => a != sender));
  });

  it('should have a delta balance equal to zero given no fee rate', async() => {
    const {1: deltaBalance} = await schnoodle.reflectTrackerInfo(sender);
    assert.equal(BigInt(deltaBalance), 0n, 'Delta balance is not equal to zero');
  });

  it('should have a higher block number after a reset', async() => {
    const {0: blockNumberBeforeReset} = await schnoodle.reflectTrackerInfo(sender);
    await schnoodle.resetReflectTracker({ from: sender });
    const {0: blockNumberAfterReset} = await schnoodle.reflectTrackerInfo(sender);
    assert.isAbove(parseInt(blockNumberAfterReset), parseInt(blockNumberBeforeReset), 'Block number was not reset');
  });
});

async function _populateAccounts() {
  // Populate all accounts with some tokens from the service account
  for (const account of accounts) {
    await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(serviceAccount)) / BigInt(accounts.length))), { from: serviceAccount });
  };
}
