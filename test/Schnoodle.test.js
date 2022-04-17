// test/Schnoodle.test.js

const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const [ serviceAccount, eleemosynaryAccount ] = accounts;
const { BN, singletons, time } = require('@openzeppelin/test-helpers');

const { testContracts } = require(`../migrations-config.develop.js`);

const { assert } = require('chai');
require('chai').should();
const Chance = require('chance');
const bigInt = require('big-integer');
const truffleAssert = require('truffle-assertions');

const chance = new Chance();
let schnoodle;
let schnoodleFarming;
let initialTokens;

const data = web3.utils.sha3(chance.string());

beforeEach(async function () {
  initialTokens = chance.integer({ min: 1000 });

  await singletons.ERC1820Registry(serviceAccount);
  const Schnoodle = contract.fromArtifact(testContracts.schnoodle);
  const SchnoodleFarming = contract.fromArtifact(testContracts.schnoodleFarming);

  schnoodle = await Schnoodle.new();
  await schnoodle.methods['initialize(uint256,address)'](initialTokens, serviceAccount);

  schnoodleFarming = await SchnoodleFarming.new();
  await schnoodleFarming.initialize(schnoodle.address);
  await schnoodle.configure(true, serviceAccount, schnoodleFarming.address, serviceAccount);
  await schnoodleFarming.configure();
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

describe('Burning', () => {
  it('should burn tokens decreasing the account\'s balance and total supply by the same amounts', async () => {
    await testBurning(await getRandomBalance(serviceAccount));
  });

  it('should burn all tokens reducing account\'s balance and total supply to zero', async () => {
    await testBurning(await getBalance(serviceAccount));
    assert.equal(await schnoodle.balanceOf(serviceAccount), 0, 'Total supply wasn\'t reduced to zero by burning');
  });

  it('should revert on attempt to burn more tokens than are available', async () => {
    // Pre-burn a token to prevent an overflow error on the reflected amount during the test burn
    await schnoodle.burn(1, data, { from: serviceAccount });
    await truffleAssert.reverts(testBurning(await getBalance(serviceAccount) + 1n), 'ERC777: burn amount exceeds balance', 'Burning of more tokens than are available did not revert');
  });

  async function testBurning(amount) {
    await testTotalSupplyDelta(serviceAccount, -amount, async() => {
      await schnoodle.burn(amount, data, { from: serviceAccount });
    });
  }
});

describe('Transfer', () => {
  let amounts;
  let senderCandidates;
  let sender;
  let recipient;
  let feeRate;
  let donationRate;
  let sowRate;

  beforeEach(async function () {
    feeRate = chance.integer({ min: 10, max: 200 });
    donationRate = chance.integer({ min: 10, max: 200 });
    sowRate = chance.integer({ min: 10, max: 200 });

    await schnoodle.changeFeeRate(feeRate);
    await schnoodle.changeEleemosynaryDetails(eleemosynaryAccount, donationRate);
    await schnoodle.changeSowRate(sowRate);
    await populateAccounts();

    amounts = {};
    for (const account of accounts) {
      amounts[account] = await getBalance(account);
    }

    // Randomly pick different sender and recipient accounts for performing the transfer test
    senderCandidates = accounts.filter(a => a != eleemosynaryAccount);
    sender = chance.pickone(senderCandidates);
    recipient = chance.pickone(senderCandidates.filter(a => a != sender));

    // Class the test transfer as a sell to test the fee distribution algorithm
    await schnoodle.grantRole(await schnoodle.LIQUIDITY(), recipient);
  });

  it('should transfer some ERC-20 tokens to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => transfer(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-20 tokens to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => transfer(schnoodle, sender, recipient, amount));
  });

  it('should transfer some ERC-20 tokens from the sender to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => transferFrom(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-20 tokens from the sender to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => transferFrom(schnoodle, sender, recipient, amount));
  });

  it('should transfer some ERC-777 tokens to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => BigInt(bigInt.randBetween(1, amount)), (schnoodle, sender, recipient, amount) => send(schnoodle, sender, recipient, amount));
  });

  it('should transfer all ERC-777 tokens to the recipient and distribute a fee to all accounts', async() => {
    await testTransfer(amount => amount, (schnoodle, sender, recipient, amount) => send(schnoodle, sender, recipient, amount));
  });

  async function transfer(schnoodle, sender, recipient, amount) {
    await schnoodle.transfer(recipient, amount, {from: sender});
  }

  async function transferFrom(schnoodle, sender, recipient, amount) {
    await schnoodle.approve(sender, amount, {from: sender});
    assert.equal(amount, BigInt(await schnoodle.allowance(sender, sender)));
    await schnoodle.transferFrom(sender, recipient, amount, {from: sender});
  }

  async function send(schnoodle, sender, recipient, amount) {
    await schnoodle.send(recipient, amount, 0, {from: sender});
  }

  async function testTransfer(amountCallback, transferCallback) {
    // Invoke the callback function to get the desired amount to transfer for this test
    const transferAmount = amountCallback(await getBalance(sender));

    await transferCallback(schnoodle, sender, recipient, transferAmount);

    let totalBalance = 0n;

    // Check the balances of all accounts to ensure they match the expected algorithm
    for (const account of accounts) {
      const oldAmount = amounts[account];

      // Determine the rate change from the old amount depending on whether the account is the sender (down), recipient (up), eleemosynary account (up) or other (zero)
      const deltaRate = account == sender
        ? -1000
        : (account == recipient
          ? 1000 - feeRate - donationRate - sowRate
          : (account == eleemosynaryAccount
            ? donationRate
            : 0));

      // The old amount is adjusted by a fraction of the transfer amount depending on the account role in the transfer (sender, recipient, eleemosynary account or other)
      const baseBalance = oldAmount + transferAmount * BigInt(deltaRate) / 1000n;

      // The expected balance should include a distribution of the fees, and therefore be higher than the base balance
      const newBalance = await getBalance(account);

      totalBalance += newBalance;

      const accountRole = account == sender ? 'sender' : (account == recipient ? 'recipient' : (account == eleemosynaryAccount ? 'eleemosynary' : ''));
      const accountIdentity = `${account}${accountRole == '' ? '' : (` (${accountRole})`)}`;
      assert.isTrue(newBalance >= baseBalance, `Account ${accountIdentity} balance incorrect after transfer`);
    }

    assert.isTrue(totalBalance - BigInt(await schnoodle.totalSupply()) < 1, 'Total of all balances doesn\'t match total supply');
  }
});

describe('Yield Farming', () => {
  let farmer;
  let depositAmount;
  let vestingBlocks;
  let unbondingBlocks;
  let farmingFund;
  let farmerStartBalance;
  let farmingFundStartBalance;

  beforeEach(async function () {
    await schnoodle.changeSowRate(chance.integer({ min: 10, max: 200 }));

    await populateAccounts();
    farmingFund = await schnoodle.getFarmingFund();
    await schnoodle.transfer(farmingFund, await getRandomBalance(serviceAccount), { from: serviceAccount });
    farmer = chance.pickone(accounts);
    depositAmount = await getRandomBalance(farmer);
    vestingBlocks = chance.integer({ min: 1, max: 20 });
    unbondingBlocks = chance.integer({ min: 1, max: 20 });
    farmerStartBalance = await getBalance(farmer);
    farmingFundStartBalance = await getBalance(farmingFund);
  });

  it('should increase the yield farmer\'s balance by a nonzero reward when a deposit with finite vesting blocks and unbonding blocks is withdrawn', async() => {
    [netReward, grossReward] = await addDepositAndWithdraw(vestingBlocks, unbondingBlocks);

    assert.isTrue(netReward > 0n && grossReward > 0n, 'Farming reward value is not positive');
    assert.equal(await getBalance(farmer), farmerStartBalance + netReward, 'Yield farmer balance wasn\'t increased by the net reward amount');
    assert.equal(await getBalance(farmingFund), farmingFundStartBalance - grossReward, 'Farming fund wasn\'t reduced by the gross reward amount');
  });

  it('should add a deposit when unbonding blocks is equal to the defined maximum', async() => {
    const unbondingBlocks = await schnoodleFarming.getMaxUnbondingBlocks();
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    const farmingSummary = await schnoodleFarming.getFarmingSummary(farmer);

    assert.lengthOf(farmingSummary, 1, 'Deposit was not successfully added');
    assert.equal(farmingSummary[0].deposit.unbondingBlocks, unbondingBlocks, 'Added deposit does not have correct unbonding blocks');
  });

  it('should unbond a deposit for longer than the unfactored unbonding blocks when unbonding blocks factor is additive', async() => {
    const unbondingBlocksFactor = chance.integer({ min: 1 });
    await schnoodleFarming.changeUnbondingBlocksFactor(unbondingBlocksFactor);
    await addDepositAndWithdraw(vestingBlocks, unbondingBlocks);
    const unbondingSummary = await schnoodleFarming.getUnbondingSummary(farmer);
    const blockNumber = await web3.eth.getBlockNumber();

    assert.lengthOf(unbondingSummary, 1, 'Deposit was not successfully placed into unbonding status');
    assert.approximately(Number(unbondingSummary[0].expiryBlock), blockNumber + unbondingBlocks * unbondingBlocksFactor / 1000, 1, 'Unbonding period was not increased by an additive unbonding blocks factor');
  });

  it('should increase the reward when the lock on a deposit is increased', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    const rewardBlock = await web3.eth.getBlockNumber() + vestingBlocks;
    const initialReward = BigInt(await schnoodleFarming.getReward(farmer, 0, rewardBlock));
    await schnoodleFarming.updateDeposit(0, vestingBlocks + 1, unbondingBlocks + 1, { from: farmer });
    const updatedReward = BigInt(await schnoodleFarming.getReward(farmer, 0, rewardBlock));
    assert.isTrue(updatedReward > initialReward, 'Increasing lock on deposit did not increase the reward');
  });

  it('should revert on attempt to withdraw after unfactored vesting blocks when vesting blocks factor is additive', async() => {
    await schnoodleFarming.changeVestingBlocksFactor(2000);
    await truffleAssert.reverts(addDepositAndWithdraw(vestingBlocks, unbondingBlocks), 'SchnoodleFarming: cannot withdraw during vesting blocks', 'Deposit was withdrawn during factored vesting blocks');
  });

  it('should revert when the lock on a deposit is updated with no increase', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    await truffleAssert.reverts(schnoodleFarming.updateDeposit(0, vestingBlocks, unbondingBlocks, { from: farmer }), 'SchnoodleFarming: no benefit to update deposit with supplied changes', 'Deposit was updated despite no lock increase');
  });

  it('should revert on attempt to add deposit with zero deposit amount', async() => {
    await truffleAssert.reverts(schnoodleFarming.addDeposit(0, vestingBlocks, unbondingBlocks, { from: farmer }), 'SchnoodleFarming: deposit amount must be greater than zero', 'Deposit was added with zero deposit amount');
  });

  it('should revert on attempt to add deposit with zero vesting blocks', async() => {
    await truffleAssert.reverts(schnoodleFarming.addDeposit(depositAmount, 0, unbondingBlocks, { from: farmer }), 'SchnoodleFarming: vesting blocks must be greater than zero', 'Deposit was added with zero vesting blocks');
  });

  it('should revert on attempt to add deposit with zero unbonding blocks', async() => {
    await truffleAssert.reverts(schnoodleFarming.addDeposit(depositAmount, vestingBlocks, 0, { from: farmer }), 'SchnoodleFarming: unbonding blocks must be greater than zero', 'Deposit was added with zero unbonding blocks');
  });

  it('should revert on attempt to add deposit with unbonding blocks above the defined maximum', async() => {
    await truffleAssert.reverts(schnoodleFarming.addDeposit(depositAmount, vestingBlocks, await schnoodleFarming.getMaxUnbondingBlocks() + 1, { from: farmer }), 'SchnoodleFarming: unbonding blocks is greater than the defined maximum', 'Deposit was added with unbonding blocks above defined maximum');
  });

  it('should revert on attempt to withdraw during vesting blocks', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    await truffleAssert.reverts(schnoodleFarming.withdraw(0, depositAmount, { from: farmer }), 'SchnoodleFarming: cannot withdraw during vesting blocks', 'Deposit was withdrawn during vesting blocks');
  });

  it('should revert on attempt to add deposit more tokens than are unlocked', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    const additionalDeposit = BigInt(bigInt.randBetween(farmerStartBalance - depositAmount + 1n, farmerStartBalance));
    await truffleAssert.reverts(schnoodleFarming.addDeposit(additionalDeposit, vestingBlocks, unbondingBlocks, { from: farmer }), 'SchnoodleFarming: deposit amount exceeds unlocked balance', 'Deposit was added with more tokens that are available');
  });

  it('should revert on attempt to transfer more tokens than are unlocked', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    const transferAmount = BigInt(bigInt.randBetween(farmerStartBalance - depositAmount + 1n, farmerStartBalance));
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, transferAmount, { from: farmer }), 'Schnoodle: transfer amount exceeds unlocked balance', 'Transfer of tokens that are not available for transfer due to being locked did not correctly revert');
  });

  it('should revert on attempt to transfer more tokens than are available including locked', async() => {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });
    await truffleAssert.reverts(schnoodle.transfer(serviceAccount, BigInt(farmerStartBalance + 1n), { from: farmer }), 'ERC777: transfer amount exceeds balance', 'Transfer of tokens that are not available for transfer due to insufficient total balance did not correctly revert');
  });

  async function addDepositAndWithdraw(vestingBlocks, unbondingBlocks) {
    await schnoodleFarming.addDeposit(depositAmount, vestingBlocks, unbondingBlocks, { from: farmer });

    Array.from({length: vestingBlocks}, async () => await time.advanceBlock());

    const receipt = await schnoodleFarming.withdraw(0, depositAmount, { from: farmer });

    let withdrawnEvent = receipt.logs.find(l => l.event == 'Withdrawn');
    return [BigInt(withdrawnEvent.args.netReward), BigInt(withdrawnEvent.args.grossReward)];
  }
});

describe('Bridge', () => {
  let holder;

  beforeEach(async function () {
    await populateAccounts();
    holder = chance.pickone(accounts);
  });

  it('should increase the tokens sent by the specified amount', async() => {
    const amount = await getRandomBalance(holder);

    await testTotalSupplyDelta(holder, -amount, async() => {
      const networkId = chance.integer({ min: 1 }); 
      await schnoodle.sendTokens(networkId, amount, { from: holder });
      assert.equal(amount, BigInt(await schnoodle.tokensSent(holder, networkId)), 'Sending tokens did not increase the tokens sent by the specified amount');
    });
  }); 

  it('should increase the tokens received by the specified amount when the exact fee is paid', async() => {
    await payFeeAndReceiveTokens(0);
  });

  it('should increase the tokens received by the specified amount when the fee is overpaid', async() => {
    await payFeeAndReceiveTokens(1);
  });

  it('should revert on attempt to receive tokens when the fee is underpaid', async() => {
    await truffleAssert.reverts(payFeeAndReceiveTokens(-1), 'Schnoodle: Insufficient fee paid', 'Receiving of tokens for which the fee was underpaid did not correctly revert');
  });

  async function payFeeAndReceiveTokens(feeDelta) {
    const amount = BigInt(chance.integer({ min: 1, max: await schnoodle.totalSupply() }));

    // Pre-burn the amount to prevent an overflow error on the reflected amount during minting
    await schnoodle.burn(amount, data, { from: serviceAccount });

    await testTotalSupplyDelta(holder, amount, async() => {
      const fee = chance.integer({ min: 1 });
      const networkId = chance.integer({ min: 1 }); 
      await schnoodle.payFee(networkId, { from: holder, value: fee + feeDelta });
      await schnoodle.receiveTokens(holder, networkId, amount, fee, { from: serviceAccount });
      assert.equal(amount, BigInt(await schnoodle.tokensReceived(holder, networkId)), 'Receiving tokens did not increase the tokens received by the specified amount');
    });
  }
});

async function testTotalSupplyDelta(account, amount, testCallback) {
  const totalSupply = BigInt(await schnoodle.totalSupply());
  const balance = await getBalance(account);

  await testCallback();

  const newTotalSupply = BigInt(await schnoodle.totalSupply());
  assert.equal(newTotalSupply, totalSupply + amount, 'Total supply didn\'t change by the expected amount');

  const newBalance = await getBalance(account);
  assert.equal(newBalance, balance + amount, 'Account balance didn\'t change by the expected amount');
}

async function getRandomBalance(account) {
  return BigInt(bigInt.randBetween(1, await getBalance(account)));
}

async function getBalance(account) {
  return BigInt(await schnoodle.balanceOf(account));
}

async function populateAccounts() {
  // Populate all accounts with some tokens from the service account
  for (const account of accounts) {
    await schnoodle.transfer(account, BigInt(bigInt.randBetween(1, await getBalance(serviceAccount) / BigInt(accounts.length))), { from: serviceAccount });
  };
}
