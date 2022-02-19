const fastify = require('fastify');
require('dotenv').config();
const Web3 = require('web3');
fs = require('fs');
var CryptoJS = require('crypto-js');
const BigNumber = require('bignumber.js');
const { password } = require('./secrets.json');

const BridgeEthereum = require('../ClientApp/src/contracts/BridgeEthereum.json');
const BridgeBsc = require('../ClientApp/src/contracts/BridgeBsc.json');

const web3Eth = new Web3(process.env.ETH_CHAIN);
const web3Bsc = new Web3(new Web3.providers.HttpProvider(process.env.BSC_CHAIN));

const bridgeEthereumDeployedNetwork = BridgeEthereum.networks[process.env.NETID_ETH];
const bridgeEthereum = new web3Eth.eth.Contract(BridgeEthereum.abi, bridgeEthereumDeployedNetwork && bridgeEthereumDeployedNetwork.address);
const bridgeBscDeployedNetwork = BridgeBsc.networks[process.env.NETID_BSC];
const bridgeBsc = new web3Bsc.eth.Contract(BridgeBsc.abi, bridgeBscDeployedNetwork && bridgeBscDeployedNetwork.address);

const expectedBlockTime = 1000;
const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

let app1 = fastify();
let app2 = fastify();
var busy = false;

// Listen
app1.listen(process.env.PORT1, process.env.URL, (err, address) => listen(err, address));
app2.listen(process.env.PORT2, process.env.URL, (err, address) => listen(err, address));

function listen(err, address) {
  if (err) {
    console.log(err);
  } else {
    console.log('Server runs on', address);
  }
}

// Check Server
app1.get('/CheckServer', async (request, reply) => checkServer(reply));
app2.get('/CheckServer', async (request, reply) => checkServer(reply));

function checkServer(reply) {
  sendReply(reply, 'Ok');
}

// Write Secret Message
app1.post('/WriteSecretMessage', async (request, reply) => writeSecretMessage(request, reply, 1));
app2.post('/WriteSecretMessage', async (request, reply) => writeSecretMessage(request, reply, 2));

async function writeSecretMessage(request, reply, serverNum) {
  const data = JSON.parse(request.body);
  const encrypted = `encrypted${serverNum}.json`;

  fs.readFile(encrypted, 'utf-8', async (error, dataFile) => {
    console.log(error);
    if (data.message.toString() !== '' && dataFile == null) {
      fs.writeFile(encrypted, JSON.stringify({ "account": data.message.toString() }), (err) => {
        if (err) {
          sendReply(reply, 'error');
        }
      });
      sendReply(reply, 'Ok');
    } else if (data.message.toString() === '') {
      sendReply(reply, 'request is empty');
    } else {
      sendReply(reply, 'Key already exists');
    }
  });
}

// Write Transaction
app1.post('/WriteTransaction', async (request, reply) => writeTransaction(request, reply, 1));
app2.post('/WriteTransaction', async (request, reply) => writeTransaction(request, reply, 2));

async function writeTransaction(request, reply, serverNum) {
  if (!busy) {
    busy = true;

    var data = JSON.parse(request.body);
    console.log('====================================================================');
    console.log(Date.now());
    console.log('Data: ', data);

    if (data.address !== '' && data.typeRecieve !== '' && data.typeSwap !== '' && data.typeRecieve != null && data.typeSwap != null) {
      //ACCOUNT
      // Decrypt the message
      const { message } = require(`./encrypted${serverNum}.json`);
      const keySize = 256;
      const iterations = 100;
      var salt = CryptoJS.enc.Hex.parse(message.substring(0, 32));
      var iv = CryptoJS.enc.Hex.parse(message.substring(32, 32));
      var key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
      var bytes = CryptoJS.AES.decrypt(message.substring(64), key, { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });

      const mainPrivateKey = bytes.toString(CryptoJS.enc.Utf8);
      const mainAccount = web3Eth.eth.accounts.privateKeyToAccount(mainPrivateKey);

      //CONTRACTS
      try {
        var tokensReceivedBnb = new BigNumber(await bridgeBsc.methods.tokensReceived(data.address).call());
        var tokensReceivedEth = new BigNumber(await bridgeEthereum.methods.tokensReceived(data.address).call());
      } catch (err) {
        console.log(err);
      }

      var tokensSentEth = new BigNumber(await bridgeEthereum.methods.tokensReceivedButNotSent(data.address).call());
      var tokensSentBnb = new BigNumber(await bridgeBsc.methods.tokensReceivedButNotSent(data.address).call());

      const receivedTotal = tokensReceivedBnb.plus(tokensReceivedEth);
      const sentTotal = tokensSentEth.plus(tokensSentBnb);
      const amount = receivedTotal.minus(sentTotal);

      console.log(`${receivedTotal} = ${tokensReceivedBnb} + ${tokensReceivedEth}`);
      console.log(`${sentTotal} = ${tokensSentBnb} + ${tokensSentEth}`);
      console.log(`Amount to send: ${amount} = ${receivedTotal} - ${sentTotal}`);

      if (data.typeRecieve === 'ERC') {
        await xxx(bridgeEthereum, web3Eth);
      } else if (data.typeRecieve === 'BEP') {
        await xxx(bridgeBsc, web3Bsc);
      }

      async function xxx(bridge, web3) {
        const send = bridge.methods.writeTransaction(data.address, amount);

        try {
          var encodedAbiSend = send.encodeABI();
        } catch (error) {
          console.log(error);
          busy = false;
          sendReply(reply, 'error', error.message);
        }

        gasPrice = await web3.eth.getGasPrice();

        let biggerGasPrice = new BigNumber(gasPrice);
        biggerGasPrice = biggerGasPrice.times(1.2).toFixed(0);
        console.log(gasPrice, biggerGasPrice);

        const txSend = {
          from: mainAccount.address,
          to: bridge.options.address,
          gasPrice: biggerGasPrice,
          data: encodedAbiSend
        };

        try {
          const gasLimit = await web3.eth.estimateGas(txSend);
          console.log(gasLimit);
          txSend.gasLimit = gasLimit;
        } catch (error) {
          console.log('Error gas');
          const gasLimit = 300000;
          txSend.gasLimit = gasLimit;
        }
        try {
          web3.eth.accounts.signTransaction(txSend, mainPrivateKey).then(async function (signed) {
            const tran = web3.eth.sendSignedTransaction(signed.rawTransaction);

            tran.on('transactionHash', async function (hash) {
              let transactionReceipt = null;
              while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(hash);
                await sleep(expectedBlockTime);
              }

              busy = false;
              console.log('>>>>>>>>Transaction Successful<<<<<<<<');
              reply
                .header('Access-Control-Allow-Origin', '*')
                .send({
                  response: 'Ok',
                  gas: transactionReceipt.gasUsed * (await web3.eth.getGasPrice())
                });
            });

            tran.on('error', error => {
              console.log(error);
              busy = false;
              sendReply(reply, 'error', error.message);
            });
          })
        } catch (err) {
          console.log(err);
          busy = false;
          sendReply(reply, 'error', err.message);
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
}

function sendReply(reply, response, error) {
  reply
    .header('Access-Control-Allow-Origin', '*')
    .send({ response, error });
}
