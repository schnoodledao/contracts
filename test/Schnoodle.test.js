// test/Schnoodle.test.js

const Schnoodle = artifacts.require("Schnoodle");

const { assert } = require("chai");
const Chance = require("chance");
const truffleAssert = require("truffle-assertions");

contract("Schnoodle", accounts => {
  const chance = new Chance();
  const feeRate = 3 / 100;

  afterEach(async () => {
    const instance = await Schnoodle.deployed();
    // Burn all remaining tokens after each test
    for (const account of accounts) {
      await instance.burn(await instance.balanceOfBurnable(account), {from: account});
    }
  });
  
  it("should show an initial balance of zero for all accounts", async () => {
    const instance = await Schnoodle.deployed();
    for (const account of accounts) {
      assert.equal((await instance.balanceOf(account)).valueOf(), 0, `Account ${account} doesn't have a zero balance`);
    }
  });

  describe("Minting", () => {
    it("should mint tokens increasing the account's balance and total supply by the same amounts", async () => {
      const instance = await Schnoodle.deployed();
      await _testMinting(chance.integer({min: 1, max: await instance.cap()}));
    });

    it("should revert on attempt to mint tokens above the supply cap", async () => {
      const instance = await Schnoodle.deployed();
      await truffleAssert.reverts(_testMinting(await instance.cap() + 1), "ERC20Capped: cap exceeded")
    });

    async function _testMinting(amount) {
      const instance = await Schnoodle.deployed();
      account = chance.pickone(accounts);

      await instance.mint(account, BigInt(amount));

      const totalSupply = await instance.totalSupply();
      assert.equal(totalSupply, amount, "Total supply wasn't affected correctly by minting");

      const balance = await instance.balanceOf(account);
      assert.equal(balance, amount, "Owner's account wasn't affected correctly by minting");
    }
  });

  describe("Transfer", () => {
    it("should transfer from the sender to the recipient and distribute a fee to all accounts", async() => {
      await _testTransfer(amount => chance.integer({min: 1, max: amount}));
    });

    it("should transfer all from the sender to the recipient and distribute a fee to all accounts", async() => {
      await _testTransfer(amount => amount);
    });

    it("should revert on attempt to transfer without enough balance", async() => {
      await truffleAssert.reverts(_testTransfer(amount => amount * 2), "Schnoodle: transfer amount exceeds balance")
    });

    async function _testTransfer(transferAmountCallback) {
      const instance = await Schnoodle.deployed();
      let amounts = {};

      // Populate all accounts with some tokens
      for (const account of accounts) {
        amounts[account] = chance.integer({min: 1, max: Number.MAX_SAFE_INTEGER / 3}); // Limit the max amount to prevent summation overflows later
        await instance.mint(account, amounts[account]);
      }

      sender = chance.pickone(accounts);
      recipient = chance.pickone(accounts);

      // Call the callback function to get a transfer amount to send
      const transferAmount = transferAmountCallback(amounts[sender]);

      // Capture the fee part of the sender's balance before transfer as this is used up first in the transfer, and must be factored into the assert algorithm later
      const balanceFee = await instance.balanceOf(sender) - await instance.balanceOfBurnable(sender);

      await instance.approve(sender, transferAmount, {from: sender});
      await instance.transfer(recipient, transferAmount, {from: sender});

      const totalFees = await instance.totalFees();
      const totalSupply = await instance.totalSupply();

      // Check the balances of all accounts to ensure they match the expected algorithm
      for (const account of accounts) {
        const oldAmount = amounts[account];

        // Sender's old amount is reduced by the transfer amount less the fee part of the account's balance; recipient's is increased by the transfer amount
        const newAmount = oldAmount + (account == sender ? -1 : (account == recipient ? 1 - feeRate : 0)) * transferAmount + (account == sender? balanceFee : 0);

        // The expected balance should also include a distribution of the total fees in proportion to the total supply
        const balance = await instance.balanceOf(account);
        assert.approximately(Number(balance), newAmount + newAmount / (totalSupply - totalFees) * totalFees, 2, `Account ${account}${account == sender ? ' (sender)' : (account == recipient ? ' (recipient)' : '')} incorrect after transfer`);
      }
    }
  });
});
