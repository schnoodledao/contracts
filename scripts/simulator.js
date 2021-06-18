// scripts/simulator.js

const { initialization } = require('../migrations-config.js');

module.exports = async function main(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];
        const Schnoodle = artifacts.require('SchnoodleV1');
        const schnoodle = await Schnoodle.new();
        await schnoodle.initialize(10000, owner, initialization.feePercent);

        const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
        const delimiter = ' | ';

        let headers = `Recipient  ${delimiter}Amount     ${delimiter}`;
        for (const account of accounts) {
            headers += `${account.slice(0, 8)}...${delimiter}`;
        }
        console.log(headers);

        let trades = [
            { account: accounts[1], amount: 909 },
            { account: accounts[2], amount: 395 },
            { account: accounts[3], amount: 362 },
            { account: accounts[4], amount: 333 },
            { account: accounts[4], amount: -307 },
            { account: accounts[5], amount: 173 },
            { account: accounts[6], amount: 56 },
            { account: accounts[7], amount: 216 }
        ];

        for (const trade of trades) {
            const amount = trade.amount;

            if (amount > 0) {
                await schnoodle.transfer(trade.account, BigInt(amount) * decimalsFactor, { from: owner });
            } else {
                await schnoodle.transfer(owner, BigInt(-amount) * decimalsFactor, { from: trade.account });
            }

            let row = `${trade.account.slice(0, 8)}...${delimiter}${amount.toString().padStart(11)}${delimiter}`;
            for (const account of accounts) {
                row += (BigInt(await schnoodle.balanceOf(account)) / decimalsFactor).toString().padStart(11) + delimiter;
            };
            console.log(row);
        };
    } catch (error) {
        console.error(error);
        callback(1);
    }
}
