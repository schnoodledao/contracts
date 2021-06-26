// scripts/simulator.js

const { initialization } = require('../migrations-config.js');

module.exports = async function main(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];
        const Schnoodle = artifacts.require('SchnoodleV1');
        const schnoodle = await Schnoodle.new();
        await schnoodle.initialize(100000, owner, initialization.feePercent);

        const decimalsFactor = BigInt(10 ** await schnoodle.decimals());
        const delimiter = ' | ';

        let headers = `Recipient  ${delimiter}Amount     ${delimiter}`;
        for (const account of accounts) {
            headers += `${account.slice(0, 8)}...${delimiter}`;
        }
        console.log(headers);

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
