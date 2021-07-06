// scripts/simulator.js

const { initialization } = require('../migrations-config.rinkeby.js');

module.exports = async function main(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];
        const eleemosynary = initialization.eleemosynary;
        const Schnoodle = artifacts.require('SchnoodleV1');
        const schnoodle = await Schnoodle.new();
        await schnoodle.initialize(100000, owner);
        schnoodle.changeFeePercent(initialization.feePercent);
        schnoodle.changeEleemosynary(eleemosynary, initialization.donationPercent);

        console.log(`Owner: ${owner}`);
        console.log(`Eleemosynary: ${eleemosynary}`);

        const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
        const delimiter = ' | ';

        // Print out the column headings
        let headers = `\nRecipient  ${delimiter}Amount     ${delimiter}`;
        for (const account of accounts) {
            headers += `${account.slice(0, 8)}...${delimiter}`;
        }
        headers += `Eleemosynary${delimiter}`;
        headers += `Total      ${delimiter}`;
        console.log(headers);

        // Set up some trades from the owner account (negative means a transfer to the owner account)
        let trades = [
            { account: accounts[1], amount: 9090 },
            { account: accounts[2], amount: 3950 },
            { account: accounts[3], amount: 3620 },
            { account: accounts[4], amount: 3330 },
            { account: accounts[4], amount: -3070 },
            { account: accounts[5], amount: 1730 },
            { account: accounts[6], amount: 560 },
            { account: accounts[7], amount: 2160 }
        ];

        for (const trade of trades) {
            const amount = trade.amount;

            // Perform the transfer from or to the owner account depending on the amount being positive or negative respectively
            if (amount > 0) {
                await schnoodle.transfer(trade.account, BigInt(amount) * decimalsFactor, { from: owner });
            } else {
                await schnoodle.transfer(owner, BigInt(-amount) * decimalsFactor, { from: trade.account });
            }

            let total = BigInt(0);
            let row = `${trade.account.slice(0, 8)}...${delimiter}${amount.toString().padStart(11)}${delimiter}`;

            // Print out all the account balances
            for (const account of accounts) {
                await addAccountColumn(account, 11);
            };

            await addAccountColumn(eleemosynary, 12);

            // Print out the total of all account balances as the last column (add 1 if necessary in case of rounding error)
            row += (total / decimalsFactor + BigInt(total % decimalsFactor == 0n ? 0 : 1)).toString().padStart(11) + delimiter;

            console.log(row);

            async function addAccountColumn(account, width) {
                const balance = BigInt(await schnoodle.balanceOf(account));
                row += (balance / decimalsFactor).toString().padStart(width) + delimiter;
                total += balance;
            }
        };
    } catch (error) {
        console.error(error);
        callback(1);
    }
}
