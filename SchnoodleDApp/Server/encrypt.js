require('dotenv').config();
var CryptoJS = require("crypto-js");
var request = require('request'); // TODO: Replace with Node fetch when available: https://github.com/nodejs/node/pull/41749
const { bridgePrivateKey, password } = require('./secrets.json');

const keySize = 256;
const iterations = 100;
const salt = CryptoJS.lib.WordArray.random(128/8);
const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
var iv = CryptoJS.lib.WordArray.random(128/8);

const encrypted = CryptoJS.AES.encrypt(bridgePrivateKey.toString(CryptoJS.format.Base64), key, { iv });

request.post({
  headers: {'content-type' : 'application/json'},
  url: `http://localhost:${process.env.PORT}/WriteSecretMessage`,
  body: JSON.stringify({ message: `${salt.toString()}${encrypted.iv.toString()}${encrypted}` })
}, function(error, response, body) {
  console.log(body);
});
