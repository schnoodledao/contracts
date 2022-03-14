require('dotenv').config();
var CryptoJS = require("crypto-js");
var request = require('request'); // TODO: Replace with Node fetch when available: https://github.com/nodejs/node/pull/41749
const { ownersPrivateKeys, password } = require('./secrets.json');

const keySize = 256;
const iterations = 100;
const salt = CryptoJS.lib.WordArray.random(128/8);
const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
var iv = CryptoJS.lib.WordArray.random(128/8);

sendMessage(0, process.env.PORT1);
sendMessage(1, process.env.PORT2);

function sendMessage(keyNum, port) {
  const encrypted = CryptoJS.AES.encrypt(ownersPrivateKeys[keyNum].toString(CryptoJS.format.Base64), key, { iv });

  request.post({
    headers: {'content-type' : 'application/json'},
    url: `http://localhost:${port}/WriteSecretMessage`,
    body: JSON.stringify({ message: `${salt.toString()}${encrypted.iv.toString()}${encrypted}` })
  }, function(error, response, body) {
    console.log(body);
  });
}
