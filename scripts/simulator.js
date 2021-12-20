// scripts/simulator.js

const Chance = require('chance');
const bigInt = require('big-integer')

module.exports = async function main(callback) {
  require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
  const { singletons } = require('@openzeppelin/test-helpers');

  try {
    const accounts = await web3.eth.getAccounts();
    const serviceAccount = accounts[0];
    const eleemosynaryAccount = accounts[1];

    await singletons.ERC1820Registry(serviceAccount);

    const { testContracts } = require(`../migrations-config.develop.js`);

    // Set up Schnoodle contract
    const Schnoodle = artifacts.require(testContracts.schnoodle);
    const schnoodle = await Schnoodle.new();
    await schnoodle.initialize(100000, serviceAccount);

    // Set up SchnoodleFarming contract
    const SchnoodleFarming = artifacts.require(testContracts.schnoodleFarming);
    const schnoodleFarming = await SchnoodleFarming.new();
    await schnoodleFarming.initialize(schnoodle.address);
    await schnoodle.configure(true, serviceAccount, schnoodleFarming.address);
    await schnoodleFarming.configure();
    const farmingFund = await schnoodle.getFarmingFund();

    const chance = new Chance();
    const feeRate = await schnoodle.getFeeRate();
    const sowRate = await schnoodle.getSowRate();
    const donationRate = chance.integer({ min: 10, max: 50 });
    await schnoodle.changeEleemosynaryDetails(eleemosynaryAccount, donationRate);

    console.log(`Service Account:      ${serviceAccount}`);
    console.log(`Eleemosynary Account: ${eleemosynaryAccount}`);
    console.log(`Farming Fund:         ${farmingFund}`);
    console.log(`Fee: ${feeRate / 10}% | Donation: ${donationRate / 10}% | Sow: ${sowRate/ 10}%`);

    const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
    const delimiter = ' | ';


    // Simulate transfers first - this will also have the effect of setting up balances in all the accounts
    _printHeadings('Simulating transfers', 'Recipient');

    // Set up some trades from the service account (negative means a transfer to the service account)
    let trades = [
      { account: accounts[2], amount: 10000 },
      { account: accounts[3], amount: 100 },
      { account: accounts[4], amount: 1000 },
      { account: accounts[4], amount: -500 },
      { account: accounts[5], amount: 10 },
      { account: accounts[6], amount: 123 },
      { account: accounts[7], amount: 4567 },
      { account: accounts[8], amount: 321 },
      { account: accounts[9], amount: 7654 },
      { account: farmingFund, amount: 1000 }
    ];

    for (const trade of trades) {
      const amount = trade.amount;

      // Perform the transfer from or to the service account depending on the amount being positive or negative respectively
      if (amount > 0) {
        await schnoodle.transfer(trade.account, BigInt(amount) * decimalsFactor, { from: serviceAccount });
      } else {
        await schnoodle.transfer(serviceAccount, BigInt(-amount) * decimalsFactor, { from: trade.account });
      }

      await _printBalances(trade.account, amount);
    };


    // Simulate yield farming based on the balances now in the accounts
    _printHeadings('Simulating yield farming', 'Farmer');

    // Set up some deposit actions to simulate (false add means withdraw)
    let depositActions = [
      { account: accounts[3], add: true },
      { account: accounts[4], add: true },
      { account: accounts[5], add: true },
      { account: accounts[6], add: true },
      { account: accounts[7], add: true },
      { account: accounts[8], add: true },
      { account: accounts[7], add: false },
      { account: accounts[9], add: true }
    ];

    for (const depositAction of depositActions) {
      let amount;

      // Add or withdraw deposit depending on the add deposit action being true or false
      if (depositAction.add) {
        amount = BigInt(bigInt.randBetween(1, BigInt(await schnoodle.balanceOf(depositAction.account))));
        await schnoodleFarming.addDeposit(amount, 1, 1, { from: depositAction.account });
      } else {
        const deposit = (await schnoodleFarming.getFarmingSummary(depositAction.account))[0].deposit;
        amount = -BigInt(deposit.amount);
        await schnoodleFarming.withdraw(deposit.id, -amount, { from: depositAction.account });
      }

      await _printBalances(depositAction.account, amount / decimalsFactor);
    };

    
    function _printHeadings(title, accountHeading) {
      console.log(`\n${title}...`);

      // Print out the column headings
      headers = `\n${accountHeading.padEnd(11)}${delimiter}Amount     ${delimiter}`;
      for (const account of accounts.concat(farmingFund)) {
        headers += `${account.slice(0, 8)}...${delimiter}`;
      }

      headers += `Total      ${delimiter}`;
      console.log(headers);
    }

    async function _printBalances(rowAccount, amount) {
      let total = BigInt(0);
      let row = `${rowAccount.slice(0, 8)}...${delimiter}${amount.toString().padStart(11)}${delimiter}`;

      // Print out all the account balances
      for (const account of accounts.concat(farmingFund)) {
        const balance = BigInt(await schnoodle.balanceOf(account));
        row += (balance / decimalsFactor).toString().padStart(11) + delimiter;
        total += balance;
      };

      // Print out the total of all account balances as the last column (add 1 if necessary in case of rounding error)
      row += (total / decimalsFactor + BigInt(total % decimalsFactor == 0n ? 0 : 1)).toString().padStart(11) + delimiter;

      console.log(row);
    }
  } catch (error) {
    console.error(error);
    callback(1);
  }
}
