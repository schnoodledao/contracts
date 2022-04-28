const path = require("path");
const { mnemonic, infuraProjectId, moralisId, etherscanApiKey, bscscanApiKey } = require('./secrets.json');
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    develop: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    },
    // Ethereum
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, `wss://ropsten.infura.io/ws/v3/${infuraProjectId}`),
      websockets: true,
      network_id: 3,
      gasPrice: 10e9,
      skipDryRun: true
    },
    rinkeby: {
      provider: () => new HDWalletProvider(mnemonic, `wss://rinkeby.infura.io/ws/v3/${infuraProjectId}`),
      websockets: true,
      network_id: 4,
      gasPrice: 10e9,
      gas: 10e6,
      skipDryRun: true
    },
    kovan: {
      provider: () => new HDWalletProvider(mnemonic, `wss://kovan.infura.io/ws/v3/${infuraProjectId}`),
      websockets: true,
      network_id: 42,
      gasPrice: 10e9,
      gas: 10e6,
      skipDryRun: true
    },
    goerli: {
      provider: () => new HDWalletProvider(mnemonic, `wss://goerli.infura.io/ws/v3/${infuraProjectId}`),
      websockets: true,
      network_id: 5,
      gasPrice: 10e9,
      gas: 10e6,
      skipDryRun: true
    },
    mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `wss://mainnet.infura.io/ws/v3/${infuraProjectId}`),
      websockets: true,
      network_id: 1,
      gasPrice: 10e9,
      gas: 10e6,
      skipDryRun: true
    },
    // BSC
    chapel: {
      provider: () => new HDWalletProvider(mnemonic, 'https://data-seed-prebsc-1-s1.binance.org:8545/'),
      websockets: true,
      network_id: 97,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    bsc: {
      provider: () => new HDWalletProvider(mnemonic, 'https://bsc-dataseed.binance.org/'),
      websockets: true,
      network_id: 56,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true
    },
  },

  mocha: {
    timeout: 200000
  },

  compilers: {
    solc: {
      version: "^0.8.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  plugins: [
    'truffle-plugin-verify'
  ],

  api_keys: {
    etherscan: etherscanApiKey,
    bscscan: bscscanApiKey
  },

  db: {
    enabled: false
  }
};
