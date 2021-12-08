const path = require("path");
const { mnemonic, infuraProjectId, etherscanApiKey } = require('./secrets.json');
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  contracts_build_directory: path.join(__dirname, "SchnoodleDApp/ClientApp/src/contracts"),

  networks: {
    develop: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
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
    }
  },

  mocha: {
    timeout: 200000
  },

  compilers: {
    solc: {
      version: "0.8.9",
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
    etherscan: etherscanApiKey
  },

  db: {
    enabled: false
  }
};
