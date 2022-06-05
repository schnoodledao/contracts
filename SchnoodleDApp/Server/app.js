'use strict'

const fastify = require('fastify');
const Web3 = require('web3');
const { writeFile } = require('fs/promises');
const CryptoJS = require('crypto-js');
const BigNumber = require('bignumber.js');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, child, increment, onValue } = require('firebase/database');

const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

const SchnoodleV1 = require('./contracts/SchnoodleV1.json');
const Schnoodle = require('./contracts/SchnoodleV9.json');

const web3Eth = new Web3(process.env.ETH_CHAIN);
const web3Bsc = new Web3(new Web3.providers.HttpProvider(process.env.BSC_CHAIN));

const schnoodleEthDeployedNetwork = SchnoodleV1.networks[process.env.NETID_ETH];
const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi, schnoodleEthDeployedNetwork && schnoodleEthDeployedNetwork.address);
const schnoodleBscDeployedNetwork = SchnoodleV1.networks[process.env.NETID_BSC];
const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi, schnoodleBscDeployedNetwork && schnoodleBscDeployedNetwork.address);

// Firebase
const database = getDatabase(initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
}));

let fees;
const dbRef = ref(database, 'bridge/fees');

get(dbRef).then(snapshot => {
  fees = snapshot.val();

  Object.keys(fees).forEach(network => {
    onValue(child(dbRef, network), (snapshot) => {
      fees[network] = snapshot.val();
    });
  });
});

const client = new SecretClient(new URL(`https://${process.env.KEY_VAULT_NAME}.vault.azure.net`).href, new DefaultAzureCredential());

function build(opts = {}) {
  const app = fastify(opts);

  app.get('/Alive', async (request, reply) => sendReply(reply, 'ok'));

  app.post('/WriteSecretMessage', async (request, reply) => {
    try {
      await writeFile('encrypted.json', JSON.stringify({ "message": request.body.message }), { flag: 'wx' });
      sendReply(reply, 'ok');
    } catch (err) {
      sendReply(reply, 'error', { message: err.message });
    }
  });

  app.post('/GetFee', async (request, reply) => {
    var data = JSON.parse(request.body);

    try {
      sendReply(reply, 'ok', { fee: fees1[data.network] });
    } catch (err) {
      console.log(err);
      sendReply(reply, 'error', { message: err.message });
    }
  });

  app.post('/GetTokensPending', async (request, reply) => {
    var data = JSON.parse(request.body);

    try {
      sendReply(reply, 'ok', { tokensPending: await getTokensPending(data) });
    } catch (err) {
      console.log(err);
      sendReply(reply, 'error', { message: err.message });
    }
  });

  app.post('/ReceiveTokens', async (request, reply) => {
    var data = JSON.parse(request.body);
    console.log('-'.repeat(60));
    console.log('Timestamp:', new Date().toISOString());
    console.log('Data:', data);

    let message;

    try {
      const web3 = getWeb3(data.targetNetwork);
      const privateKey = (await decryptMessage()).toString(CryptoJS.enc.Utf8);
      const schnoodleReceiver = getContract(data.targetNetwork);
      const tokensPending = await getTokensPending(data, true);
      const sourceNetworkId = await getNetworkId(data.sourceNetwork);
      const feePaid = await schnoodleReceiver.methods.feesPaid(data.address, sourceNetworkId).call();

      // Build transaction to call receiveTokens
      const txReceive = {
        from: web3.eth.accounts.privateKeyToAccount(privateKey).address,
        to: schnoodleReceiver.options.address,
        gasPrice: (new BigNumber(await web3.eth.getGasPrice())).times(1.2).toFixed(0),
        data: schnoodleReceiver.methods.receiveTokens(data.address, sourceNetworkId, tokensPending, fees[data.targetNetwork]).encodeABI()
      };

      txReceive.gasLimit = await web3.eth.estimateGas(txReceive) * 2;
      const receipt = await web3.eth.sendSignedTransaction((await web3.eth.accounts.signTransaction(txReceive, privateKey)).rawTransaction);

      if (receipt.status) {
        // Adjust the fee tally for the network by the cost of the above transaction less that paid by the user
        await set(child(dbRef, data.targetNetwork), increment(receipt.gasUsed * txReceive.gasPrice - feePaid));
        sendReply(reply, 'ok');
      }
    } catch (err) {
      console.log(err);
      sendReply(reply, 'error', { message: err.message });
    }
  });

  return app;

  async function getTokensPending(data, log) {
    const tokensSent = new BigNumber(await getContract(data.sourceNetwork).methods.tokensSent(data.address, await getNetworkId(data.targetNetwork)).call());
    const tokensReceived = new BigNumber(await getContract(data.targetNetwork).methods.tokensReceived(data.address, await getNetworkId(data.sourceNetwork)).call());
    const tokensPending = tokensSent.minus(tokensReceived);

    if (tokensPending > 0 && log) {
      console.log(`${tokensPending} tokens pending to bridge from ${data.sourceNetwork} to ${data.targetNetwork} (${tokensSent} sent less ${tokensReceived} received).`);
    }

    return tokensPending;
  }

  function getWeb3(network) {
    switch (network) {
      case 'ethereum':
        return web3Eth;
      case 'bsc':
        return web3Bsc;
      default:
        throw `Network not supported: ${network}`;
    }
  }

  async function getNetworkId(network) {
    return await getWeb3(network).eth.net.getId();
  }

  function getContract(network) {
    switch (network) {
      case 'ethereum':
        return schnoodleEth;
      case 'bsc':
        return schnoodleBsc;
      default:
        throw `Network not supported: ${network}`;
    }
  }

  async function decryptMessage() {
    const { message } = require(`./encrypted.json`);
    const keySize = 256;
    const iterations = 100;
    const password = process.env.BRIDGE_PASSWORD || (await client.getSecret('bridgePassword')).value;
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
}

module.exports = build
