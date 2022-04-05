const fastify = require('fastify');
const Web3 = require('web3');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const BigNumber = require('bignumber.js');
const { password } = require('./secrets.json');

const SchnoodleV1 = require('../ClientApp/src/contracts/SchnoodleV1.json');
const Schnoodle = require('../ClientApp/src/contracts/SchnoodleV9.json');

const web3Eth = new Web3(process.env.ETH_CHAIN);
const web3Bsc = new Web3(new Web3.providers.HttpProvider(process.env.BSC_CHAIN));

const schnoodleEthDeployedNetwork = SchnoodleV1.networks[process.env.NETID_ETH];
const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi, schnoodleEthDeployedNetwork && schnoodleEthDeployedNetwork.address);
const schnoodleBscDeployedNetwork = SchnoodleV1.networks[process.env.NETID_BSC];
const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi, schnoodleBscDeployedNetwork && schnoodleBscDeployedNetwork.address);

let latestFee = 0;

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

app.post('/GetReceiptDetails', async (request, reply) => {
  var data = JSON.parse(request.body);
  console.log('-'.repeat(60));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Data:', data);

  try {
    sendReply(reply, 'ok', { tokensPending: await getTokensPending(data), fee: latestFee });
  } catch (err) {
    console.log(err);
    sendReply(reply, 'error', { err });
  }
});

app.post('/ReceiveTokens', async (request, reply) => {
  var data = JSON.parse(request.body);
  console.log('-'.repeat(60));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Data:', data);

  let message;

  try {
    const web3 = getWeb3(data.network);
    const privateKey = decryptMessage().toString(CryptoJS.enc.Utf8);
    const schnoodleReceiver = getContract(data.network);
    const tokensPending = await getTokensPending(data);

    // Build transaction to call receiveTokens
    const txSend = {
      from: web3.eth.accounts.privateKeyToAccount(privateKey).address,
      to: schnoodleReceiver.options.address,
      gasPrice: (new BigNumber(await web3.eth.getGasPrice())).times(1.2).toFixed(0),
      data: schnoodleReceiver.methods.receiveTokens(data.address, tokensPending, 0).encodeABI()
    };

    txSend.gasLimit = await web3.eth.estimateGas(txSend) * 2;
    txSend.data = schnoodleReceiver.methods.receiveTokens(data.address, tokensPending, latestFee).encodeABI();

    const receipt = await web3.eth.sendSignedTransaction((await web3.eth.accounts.signTransaction(txSend, privateKey)).rawTransaction);
    
    if (receipt.status) {
      latestFee = receipt.gasUsed * txSend.gasPrice;
      sendReply(reply, 'ok');
    }
  } catch (err) {
    console.log(err);
    message = err.message;
  }

  sendReply(reply, 'error', { message });
});

async function getTokensPending(data) {
  const senderNetwork = data.network === 'Ethereum' ? 'BSC' : 'Ethereum';
  const schnoodleReceiver = getContract(data.network);
  const schnoodleSender = getContract(senderNetwork);

  const tokensSent = new BigNumber(await schnoodleSender.methods.tokensSent(data.address).call());
  const tokensReceived = new BigNumber(await schnoodleReceiver.methods.tokensReceived(data.address).call());
  const tokensPending = tokensSent.minus(tokensReceived);

  if (tokensPending > 0) {
    console.log(`${tokensPending} tokens pending to bridge from ${senderNetwork} to ${data.network} (${tokensSent} sent less ${tokensReceived} received).`);
  }

  return tokensPending;
}

function getWeb3(network) {
  switch (network) {
    case 'Ethereum':
      return web3Eth;
    case 'BSC':
      return web3Bsc;
    default:
      throw `Network not supported: ${network}`;
  }
}

function getContract(network) {
  switch (network) {
    case 'Ethereum':
      return schnoodleEth;
    case 'BSC':
      return schnoodleBsc;
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
