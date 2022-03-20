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

const pendingTransactions = {};

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

let app = fastify();
app.listen(process.env.PORT, process.env.URL, (err, address) => listen(err, address));

function listen(err, address) {
  if (err) {
    console.log(err);
  } else {
    console.log('Server runs on', address);
  }
}

app.get('/Alive', async (request, reply) => sendReply(reply, 'ok'));

app.post('/WriteSecretMessage', async (request, reply) => {
  const encrypted = `encrypted.json`;

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
});

app.post('/GetFee', async (request, reply) => {
  var data = JSON.parse(request.body);
  console.log('====================================================================');
  console.log(Date.now().toString());
  console.log('Data: ', data);

  const decrypted = decryptMessage();
  const privateKey = decrypted.toString(CryptoJS.enc.Utf8);
  const account = web3Eth.eth.accounts.privateKeyToAccount(privateKey);

  try {
    const senderNetwork = data.network === 'Ethereum' ? 'BSC' : 'Ethereum';
    const web3 = getWeb3(data.network);
    const bridgeReceiver = getBridge(data.network);
    const bridgeSender = getBridge(senderNetwork);

    const tokensSent = new BigNumber(await bridgeSender.methods.tokensSent(data.address).call());
    const tokensReceived = new BigNumber(await bridgeReceiver.methods.tokensReceived(data.address).call());
    const tokensPending = tokensSent.minus(tokensReceived);
    let fee = 0;

    if (tokensPending > 0) {
      console.log(`${tokensPending} tokens pending to bridge from ${senderNetwork} to ${data.network} (${tokensSent} sent less ${tokensReceived} received).`);

      // Build transaction to call receiveTokens, and store it for later execution
      const txSend = {
        from: account.address,
        to: bridgeReceiver.options.address,
        gasPrice: (new BigNumber(await web3.eth.getGasPrice())).times(1.2).toFixed(0),
        data: bridgeReceiver.methods.receiveTokens(data.address, tokensPending, 0).encodeABI()
      };

      txSend.gasLimit = await web3.eth.estimateGas(txSend);
      fee = txSend.gasLimit * txSend.gasPrice;
      txSend.data = bridgeReceiver.methods.receiveTokens(data.address, tokensPending, fee).encodeABI();
      pendingTransactions[data.address] = txSend;
    }

    sendReply(reply, 'ok', { tokensPending, fee });
  } catch (err) {
    console.log(err);
    sendReply(reply, 'error', { err });
  }
});

app.post('/ReceiveTokens', async (request, reply) => {
  var data = JSON.parse(request.body);
  console.log('====================================================================');
  console.log(Date.now().toString());
  console.log('Data: ', data);

  const decrypted = decryptMessage();
  const privateKey = decrypted.toString(CryptoJS.enc.Utf8);

  try {
    const web3 = getWeb3(data.targetNetwork);
    const txSend = pendingTransactions[data.address];

    web3.eth.sendSignedTransaction((await web3.eth.accounts.signTransaction(txSend, privateKey)).rawTransaction)
      .on('transactionHash', async function (hash) {
        let transactionReceipt = null;
        while (transactionReceipt == null) {
          transactionReceipt = await web3.eth.getTransactionReceipt(hash);
          await sleep(1000);
        }

        console.log('>>>>>>>> Transaction Successful <<<<<<<<');
        sendReply(reply, 'ok');
      })
      .on('error', error => {
        throw(error);
      });
  } catch (err) {
    console.log(err);
    sendReply(reply, 'error', { err });
  }
});

function getWeb3(network) {
  switch (network) {
    case 'Ethereum':
      return web3Eth;
    case 'BSC':
      return web3Bsc;
    default:
      throw `Network not supported: ${data.targetNetwork}`;
  }
}

function getBridge(network) {
  switch (network) {
    case 'Ethereum':
      return bridgeEthereum;
    case 'BSC':
      return bridgeBsc;
    default:
      throw `Network not supported: ${data.targetNetwork}`;
  }
}

function decryptMessage() {
  const { message } = require(`./encrypted.json`);
  const keySize = 256;
  const iterations = 100;
  const salt = CryptoJS.enc.Hex.parse(message.substring(0, 32));
  const iv = CryptoJS.enc.Hex.parse(message.substring(32, 64));
  const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
  return CryptoJS.AES.decrypt(message.substring(64), key, { iv });
}

function sendReply(reply, status, body) {
  reply
    .header('Access-Control-Allow-Origin', '*')
    .send({ status, body });
}
