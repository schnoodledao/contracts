 const { mnemonic, infuraProjectId, etherscanApiKey } = require('./secrets.json');
 const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${infuraProjectId}`),
      network_id: 3,
      gasPrice: 10e9,
      skipDryRun: true
    },
    rinkeby: {
      provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${infuraProjectId}`),
      network_id: 4,
      gasPrice: 10e9,
      skipDryRun: true
    },
    kovan: {
      provider: () => new HDWalletProvider(mnemonic, `https://kovan.infura.io/v3/${infuraProjectId}`),
      network_id: 42,
      gasPrice: 10e9,
      skipDryRun: true
    },
    goerli: {
      provider: () => new HDWalletProvider(mnemonic, `https://goerli.infura.io/v3/${infuraProjectId}`),
      network_id: 5,
      gasPrice: 10e9,
      skipDryRun: true
    }
  },

  mocha: {
    timeout: 200000
  },

  compilers: {
    solc: {
      version: "^0.8.0",
      settings: {
        optimizer: {
          enabled: false,
          runs: 200
        },
        evmVersion: "byzantium"
      }
    }
  },

  plugins: [
    'truffle-plugin-verify'
  ],

  api_keys: {
    etherscan: etherscanApiKey
  },

  db: {
    enabled: false
  }
};
