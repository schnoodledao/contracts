const fastify = require('fastify');
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

function sleep(milliseconds) {
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
  const encrypted = `encrypted${serverNum}.json`;

  fs.readFile(encrypted, 'utf-8', async (err, dataFile) => {
    if (err) {
      sendReply(reply, 'error', { err });
    }

    const message = request.body.message;

    if (message === '') {
      sendReply(reply, 'error', { message: 'Message is empty' });
    } else if (dataFile != null) {
      sendReply(reply, 'error', { message: 'Message file already exists' });
    }
    else {
      fs.writeFile(encrypted, JSON.stringify({ "message": message }), (err) => {
        if (err) {
          sendReply(reply, 'error', { err });
        }
        sendReply(reply, 'ok');
      });
    }
  });
}

// Write Transaction
app1.post('/WriteTransaction', async (request, reply) => writeTransaction(request, reply, 1));
app2.post('/WriteTransaction', async (request, reply) => writeTransaction(request, reply, 2));

async function writeTransaction(request, reply, serverNum) {
  if (busy) {
    sendReply(reply, 'busy');
  }

  busy = true;

  var data = JSON.parse(request.body);
  console.log('====================================================================');
  console.log(Date.now());
  console.log('Data: ', data);

  //if (data.address !== '' && data.targetNetwork !== '' && data.sourceNetwork !== '' && data.targetNetwork != null && data.sourceNetwork != null) {

  //ACCOUNT
  // Decrypt the message
  const { message } = require(`./encrypted${serverNum}.json`);
  const keySize = 256;
  const iterations = 100;
  const salt = CryptoJS.enc.Hex.parse(message.substring(0, 32));
  const iv = CryptoJS.enc.Hex.parse(message.substring(32, 64));
  const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
  const decrypted = CryptoJS.AES.decrypt(message.substring(64), key, { iv });

  const mainPrivateKey = decrypted.toString(CryptoJS.enc.Utf8);
  const mainAccount = web3Eth.eth.accounts.privateKeyToAccount(mainPrivateKey);

  //CONTRACTS
  try {
    const tokensReceivedBnb = new BigNumber(await bridgeBsc.methods.tokensReceived(data.address, false).call());
    const tokensReceivedEth = new BigNumber(await bridgeEthereum.methods.tokensReceived(data.address, false).call());
    const tokensSentEth = new BigNumber(await bridgeEthereum.methods.tokensReceived(data.address, true).call());
    const tokensSentBnb = new BigNumber(await bridgeBsc.methods.tokensReceived(data.address, true).call());

    const receivedTotal = tokensReceivedBnb.plus(tokensReceivedEth);
    const sentTotal = tokensSentEth.plus(tokensSentBnb);
    const amount = receivedTotal.minus(sentTotal);

    console.log(`${receivedTotal} = ${tokensReceivedBnb} + ${tokensReceivedEth}`);
    console.log(`${sentTotal} = ${tokensSentBnb} + ${tokensSentEth}`);
    console.log(`Amount to send: ${amount} = ${receivedTotal} - ${sentTotal}`);
    
    switch (data.targetNetwork) {
      case 'Ethereum':
        await writeTransaction(bridgeEthereum, web3Eth);
        break;
      case 'BSC':
        await writeTransaction(bridgeBsc, web3Bsc);
        break;
      default:
        throw `Network not supported: ${data.targetNetwork}`;
    }

    async function writeTransaction(bridge, web3) {
      const txSend = {
        from: mainAccount.address,
        to: bridge.options.address,
        gasPrice: (new BigNumber(await web3.eth.getGasPrice())).times(1.2).toFixed(0),
        data: bridge.methods.writeTransaction(data.address, amount).encodeABI()
      };

      txSend.gasLimit = await web3.eth.estimateGas(txSend);

      web3.eth.sendSignedTransaction((await web3.eth.accounts.signTransaction(txSend, mainPrivateKey)).rawTransaction)
        .on('transactionHash', async function (hash) {
          let transactionReceipt = null;
          while (transactionReceipt == null) {
            transactionReceipt = await web3.eth.getTransactionReceipt(hash);
            await sleep(1000);
          }

          busy = false;
          console.log('>>>>>>>> Transaction Successful <<<<<<<<');
          sendReply(reply, 'ok', { gas: transactionReceipt.gasUsed * (await web3.eth.getGasPrice()) });
        })
        .on('error', error => {
          throw(error);
        });
    }
  } catch (err) {
    console.log(err);
    busy = false;
    sendReply(reply, 'error', { err });
  }
}

function sendReply(reply, status, body) {
  reply
    .header('Access-Control-Allow-Origin', '*')
    .send({ status, body });
}
