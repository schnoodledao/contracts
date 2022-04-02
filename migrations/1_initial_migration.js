// migrations/1_initial_migration.js

const Migrations = artifacts.require('Migrations');

module.exports = async function (deployer) {
  await deployer.deploy(Migrations);
};
