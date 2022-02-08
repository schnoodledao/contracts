const fastify = require('fastify')();
require('dotenv').config();
const Web3 = require('web3');
fs = require('fs');
var CryptoJS = require("crypto-js");
const BigNumber = require('bignumber.js');
const { password } = require('./secrets.json');
const { message } = require('./encrypted.json');

const web3bnb = new Web3(new Web3.providers.HttpProvider(process.env.BSC_CHAIN));
const web3 = new Web3(process.env.ETH_CHAIN);

const expectedBlockTime = 1000;
const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

fastify.listen(process.env.PORT, process.env.URL, function (err, address) {
  if (err) {
    console.log(err);
  } else {
    console.log('Server runs on', address);
  }
})

fastify.get('/CheckServer', async (request, reply) => {
  sendReply(reply, 'Ok');
});

fastify.post('/WriteSecretMessage', async (request, reply) => {
  const data = JSON.parse(request.body);
  fs.readFile('encrypted.json', 'utf-8', async (error, dataFile) => {
    console.log(error);
    if (data.message.toString() != "" && dataFile == null) {
      fs.writeFile('encrypted.json', JSON.stringify({ "account": data.message.toString() }), (err) => {
        if (err) {
          sendReply(reply, 'error');
        }
      });
      sendReply(reply, 'Ok');
    } else if (data.message.toString() === "") {
      sendReply(reply, 'request is empty');
    } else {
      sendReply(reply, 'Key already exists');
    }
  });
});

const EthContractAddress = "";
const EthContractAbi = [];

const BscContractAddress = "";
const BscContractAbi = [];

var busy = false;

fastify.post('/WriteTransaction', async (request, reply) => {
  if (busy === false) {
    busy = true;

    var data = JSON.parse(request.body);
    console.log("====================================================================");
    console.log(Date.now());
    console.log("Data: ", data);

    if (data.address != "" && data.typeRecieve != "" && data.typeSwap != "" && data.typeRecieve != null && data.typeSwap != null) {
      //ACCOUNT
      // Decrypt the message
      const keySize = 256;
      const iterations = 100;
      var salt = CryptoJS.enc.Hex.parse(message.substring(0, 32));
      var iv = CryptoJS.enc.Hex.parse(message.substring(32, 32));
      var key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
      var bytes = CryptoJS.AES.decrypt(message.substring(64), key, { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });

      var originalAcc = bytes.toString(CryptoJS.enc.Utf8);
      const mainPrivateKey = originalAcc;
      const mainAccount = web3.eth.accounts.privateKeyToAccount(mainPrivateKey);

      //CONTRACTS
      const EthContract = new web3.eth.Contract(EthContractAbi, EthContractAddress);
      const BNBContract = new web3bnb.eth.Contract(BscContractAbi, BscContractAddress);

      try {
        var tokensReceivedBNB = new BigNumber(await BNBContract.methods.tokensReceived(data.address).call());
        var tokensReceivedETH = new BigNumber(await EthContract.methods.tokensReceived(data.address).call());
      } catch (err) {
        console.log(err)
      }

      var tokensSentETH = new BigNumber(await EthContract.methods.tokensReceivedButNotSent(data.address).call());
      var tokensSentBNB = new BigNumber(await BNBContract.methods.tokensReceivedButNotSent(data.address).call());

      const receivedTotal = tokensReceivedBNB.plus(tokensReceivedETH);
      const sentTotal = tokensSentETH.plus(tokensSentBNB);
      const amount = receivedTotal.minus(sentTotal);

      console.log(`${receivedTotal} = ${tokensReceivedBNB} + ${tokensReceivedETH}`);
      console.log(`${sentTotal} = ${tokensSentBNB} + ${tokensSentETH}`);
      console.log(`Amount to send: ${amount} = ${receivedTotal} - ${sentTotal}`);

      if (data.typeRecieve == "ERC") {
        var send = EthContract.methods.writeTransaction(data.address, amount);

        try {
          var encodedABIsend = send.encodeABI();
        } catch (error) {
          console.log(error);
          busy = false;
          sendReply(reply, 'error', error.message);
        }

        gasPrice = await web3.eth.getGasPrice();

        let BiggerGasPrice = new BigNumber(gasPrice);
        BiggerGasPrice = BiggerGasPrice.times(1.2).toFixed(0);
        console.log(gasPrice, BiggerGasPrice);

        var txSend = {
          from: mainAccount.address,
          to: EthContractAddress,
          gasPrice: BiggerGasPrice,
          data: encodedABIsend,
        }

        try {
          var gasLimit = await web3.eth.estimateGas(txSend);
          console.log(gasLimit);
          txSend.gasLimit = gasLimit;
        } catch (error) {
          console.log("Error gas");
          var gasLimit = 300000;
          txSend.gasLimit = gasLimit;
        }

        try {
          web3.eth.accounts.signTransaction(txSend, mainPrivateKey).then(async function (signed) {
            var tran = web3.eth.sendSignedTransaction(signed.rawTransaction);

            tran.on('transactionHash', async function (hash) {
              let transactionReceipt = null;
              while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(hash);
                await sleep(expectedBlockTime);
              }

              busy = false;
              console.log(">>>>>>>>Transaction Successful<<<<<<<<");
              reply
                .header("Access-Control-Allow-Origin", "*")
                .send({
                  response: 'Ok',
                  gas: transactionReceipt.gasUsed * (await web3.eth.getGasPrice())
                });
            })

            tran.on('error', error => {
              console.log(error);
              busy = false;
              sendReply(reply, 'error', error.message);
            });
          })
        } catch (error) {
          console.log(error);
          busy = false;
          sendReply(reply, 'error', error.message);
        }
      } else if (data.typeRecieve == "BEP") {
        var send = BNBContract.methods.writeTransaction(data.address, amount);

        try {
          var encodedABIsend = send.encodeABI();
        } catch (error) {
          console.log(error);
          busy = false;
          sendReply(reply, 'error', error.message);
        }

        gasPrice = await web3bnb.eth.getGasPrice();

        let biggerGasPrice = new BigNumber(gasPrice);
        biggerGasPrice = biggerGasPrice.times(1.2).toFixed(0);
        console.log(gasPrice, biggerGasPrice);

        var txSend = {
          from: mainAccount.address,
          to: BscContractAddress,
          gasPrice: biggerGasPrice,
          data: encodedABIsend,
        };

        try {
          var gasLimit = await web3bnb.eth.estimateGas(txSend);
          console.log(gasLimit);
          txSend.gasLimit = gasLimit;
        } catch (error) {
          console.log("Error gas");
          var gasLimit = 300000;
          txSend.gasLimit = gasLimit;
        }

        try {
          web3bnb.eth.accounts.signTransaction(txSend, mainPrivateKey).then(async function (signed) {
            var tran = web3bnb.eth.sendSignedTransaction(signed.rawTransaction);

            tran.on('transactionHash', async function (hash) {
              let transactionReceipt = null;
              while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3bnb.eth.getTransactionReceipt(hash);
                await sleep(expectedBlockTime);
              }

              busy = false;
              console.log(">>>>>>>>Transaction Successful<<<<<<<<");
              reply
                .header("Access-Control-Allow-Origin", "*")
                .send({
                  response: 'Ok',
                  gas: transactionReceipt.gasUsed * (await web3bnb.eth.getGasPrice())
                });
            })

            tran.on('error', error => {
              console.log(error);
              busy = false;
              sendReply(reply, 'error', error.message);
            });
          })
        } catch (error) {
          console.log(error);
          busy = false;
          sendReply(reply, 'error', error.message);
        }
      }
    } else if (process.env.KEY == null) {
      busy = false;
      sendReply(reply, 'Empty Key');
    } else if (error != null) {
      console.log(error);
      busy = false;
      sendReply(reply, 'error', error.message);
    } else {
      busy = false;
      sendReply(reply, 'Empty Address');
    }
  } else {
    sendReply(reply, 'busy');
  }
});

function sendReply(reply, response, error) {
  reply
    .header("Access-Control-Allow-Origin", "*")
    .send({ response, error });
}
