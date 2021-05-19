// migrations/2_deploy.js

const Token = artifacts.require('Schnoodle');

module.exports = function(deployer) {
  deployer.deploy(Token);
};
