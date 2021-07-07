// scripts/simulator.js

const Chance = require('chance');

module.exports = async function main(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const serviceAccount = accounts[0];
        const eleemosynary = accounts[1];
        const Schnoodle = artifacts.require('SchnoodleV1');
        const schnoodle = await Schnoodle.new();
        await schnoodle.initialize(100000, serviceAccount);

        const chance = new Chance();
        const feePercent = chance.integer({ min: 1, max: 5 });
        const donationPercent = chance.integer({ min: 1, max: 5 });
        schnoodle.changeFeePercent(feePercent);
        schnoodle.changeEleemosynary(eleemosynary, donationPercent);

        console.log(`Service Account: ${serviceAccount}`);
        console.log(`Eleemosynary: ${eleemosynary}`);
        console.log(`Fee: ${feePercent}% | Donation: ${donationPercent}%`);

        const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
        const delimiter = ' | ';

        // Print out the column headings
        let headers = `\nRecipient  ${delimiter}Amount     ${delimiter}`;
        for (const account of accounts) {
            headers += `${account.slice(0, 8)}...${delimiter}`;
        }

        headers += `Total      ${delimiter}`;
        console.log(headers);

        // Set up some trades from the service account (negative means a transfer to the service account)
        let trades = [
            { account: accounts[2], amount: 10 },
            { account: accounts[3], amount: 100 },
            { account: accounts[4], amount: 1000 },
            { account: accounts[5], amount: 10000 },
            { account: accounts[5], amount: -5000 },
            { account: accounts[6], amount: 123 },
            { account: accounts[7], amount: 4567 },
            { account: accounts[8], amount: 321 },
            { account: accounts[9], amount: 7654 }
        ];

        for (const trade of trades) {
            const amount = trade.amount;

            // Perform the transfer from or to the service account depending on the amount being positive or negative respectively
            if (amount > 0) {
                await schnoodle.transfer(trade.account, BigInt(amount) * decimalsFactor, { from: serviceAccount });
            } else {
                await schnoodle.transfer(serviceAccount, BigInt(-amount) * decimalsFactor, { from: trade.account });
            }

            let total = BigInt(0);
            let row = `${trade.account.slice(0, 8)}...${delimiter}${amount.toString().padStart(11)}${delimiter}`;

            // Print out all the account balances
            for (const account of accounts) {
                const balance = BigInt(await schnoodle.balanceOf(account));
                row += (balance / decimalsFactor).toString().padStart(11) + delimiter;
                total += balance;
            };

            // Print out the total of all account balances as the last column (add 1 if necessary in case of rounding error)
            row += (total / decimalsFactor + BigInt(total % decimalsFactor == 0n ? 0 : 1)).toString().padStart(11) + delimiter;

            console.log(row);
        };
    } catch (error) {
        console.error(error);
        callback(1);
    }
}
