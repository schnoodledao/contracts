// migrations/2_deploy.js

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Schnoodle = artifacts.require('Schnoodle');

module.exports = async function (deployer) {
  await deployProxy(Schnoodle, { deployer });
};
