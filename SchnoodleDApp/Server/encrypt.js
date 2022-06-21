var argv = require('minimist')(process.argv.slice(2));
const CryptoJS = require("crypto-js");
const request = require('request'); // TODO: Replace with Node fetch when available: https://github.com/nodejs/node/pull/41749

const keySize = 256;
const iterations = 100;
const salt = CryptoJS.lib.WordArray.random(128/8);
const key = CryptoJS.PBKDF2(process.env.BRIDGE_PASSWORD, salt, { keySize: keySize / 32, iterations });
const iv = CryptoJS.lib.WordArray.random(128/8);

const encrypted = CryptoJS.AES.encrypt(process.env.BRIDGE_PRIVATE_KEY.toString(CryptoJS.format.Base64), key, { iv });

request.post({
  headers: {'content-type' : 'application/json'},
  url: `${argv.server}/WriteSecretMessage`,
  body: JSON.stringify({ message: `${salt.toString()}${encrypted.iv.toString()}${encrypted}` })
}, function(error, response, body) {
  console.log(body);
});
