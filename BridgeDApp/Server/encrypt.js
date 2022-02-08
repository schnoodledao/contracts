var CryptoJS = require("crypto-js");
const { ownersPrivateKeys, password } = require('./secrets.json');

const keySize = 256;
const iterations = 100;
const salt = CryptoJS.lib.WordArray.random(128/8);
const key = CryptoJS.PBKDF2(password, salt, { keySize: keySize / 32, iterations });
var iv = CryptoJS.lib.WordArray.random(128/8);

const cfg = { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC };

const encrypted1 = CryptoJS.AES.encrypt(ownersPrivateKeys[0], key, cfg);
const encrypted2 = CryptoJS.AES.encrypt(ownersPrivateKeys[1], key, cfg);

console.log(salt.toString() + iv.toString() + encrypted1.toString());
console.log(salt.toString() + iv.toString() + encrypted2.toString());
