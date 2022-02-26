require('dotenv').config();
var CryptoJS = require("crypto-js");
var request = require('request');
const { ownersPrivateKeys, password } = require('./secrets.json');

const keySize = 256;
const iterations = 100;
const salt = CryptoJS.lib.WordArray.random(128/8);
const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
var iv = CryptoJS.lib.WordArray.random(128/8);

const cfg = { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC };

sendMessage(0, process.env.PORT1);
sendMessage(1, process.env.PORT2);

function sendMessage(keyNum, port) {
  const encrypted = CryptoJS.AES.encrypt(ownersPrivateKeys[keyNum], key, cfg);

  request.post({
    headers: {'content-type' : 'application/json'},
    url:     `http://localhost:${port}/WriteSecretMessage`,
    body:    `{"message": "${salt.toString() + iv.toString() + encrypted.toString()}"}`
  }, function(error, response, body){
    console.log(body);
  });    
}
