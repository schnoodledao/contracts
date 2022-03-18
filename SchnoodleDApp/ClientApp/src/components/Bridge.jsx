import React, { Component } from 'react';
import { bridge as resources } from '../resources';
import './Bridge.css'
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import SchnoodleV9 from '../contracts/SchnoodleV9.json';
import BridgeEthereum from '../contracts/BridgeEthereum.json';
import BridgeBsc from '../contracts/BridgeBsc.json';
import getWeb3 from '../getWeb3';
import { ConnectWallet } from './ConnectWallet';
import { initializeHelpers, scaleUpUnits, scaleDownUnits, waitForTransaction, createEnum, sleep } from '../helpers';

// Third-party libraries
import $ from 'jquery';
import Web3 from 'web3';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import Select from 'react-select';

const Network = createEnum(['Ethereum', 'BSC']);

export class Bridge extends Component {
  static displayName = Bridge.name;

  constructor(props) {
    super(props);

    this.state = {
      success: false,
      message: null,
      busyApprove: false,
      busySwap: false,
      busyReceive: false,
      selectedAddress: null,
      web3: null,
      web3Eth: null,
      web3Bsc: null,
      gasPrice: null,
      schnoodle: null,
      schnoodleEthNetwork: null,
      schnoodleEth: null,
      schnoodleBscNetwork: null,
      schnoodleBsc: null,
      bridge: null,
      bridgeEthereumNetwork: null,
      bridgeEthereum: null,
      bridgeBscNetwork: null,
      bridgeBsc: null,
      allowance: 0,
      database: null,
      fees: null,
      tokensReceived: 0,
      amount: 0,
      chainId: 0,
      hash: null,
      serverStatus: true,
      serverError: null,
      showClose: false,
      gasPay: [],
      sourceNetwork: null,
      targetNetwork: null,
      typeSwap: null
    }

    this.updateAllowance = this.updateAllowance.bind(this);
    this.sendTokens = this.sendTokens.bind(this);
    this.receiveTokens = this.receiveTokens.bind(this);
    this.resetAllowance = this.resetAllowance.bind(this);
    this.changeSourceNetwork = this.changeSourceNetwork.bind(this);
    this.changeTargetNetwork = this.changeTargetNetwork.bind(this);
    this.updateAmount = this.updateAmount.bind(this);
  }

  async componentDidMount() {
    try {
      this.checkServerStatus();

      // Connecting burger
      $('.burger').click(function () {
        $('.burger-list').toggleClass('active');
        $('.burger').toggleClass('active');
      });

      // Firebase
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
      };

      const app = initializeApp(firebaseConfig);
      const database = getDatabase(app);

      // Web3
      const web3 = await getWeb3();
      const web3Eth = new Web3(process.env.REACT_APP_ETH_CHAIN);
      const web3Bsc = new Web3(new Web3.providers.HttpProvider(process.env.REACT_APP_BSC_CHAIN));
      const gasPrice = await web3.eth.getGasPrice() / 1e18;

      // Smart contracts
      const schnoodleEthNetwork = SchnoodleV1.networks[process.env.REACT_APP_NETID_ETH];
      const schnoodleEth = new web3Eth.eth.Contract(SchnoodleV9.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = SchnoodleV1.networks[process.env.REACT_APP_NETID_BSC];
      const schnoodleBsc = new web3Bsc.eth.Contract(SchnoodleV9.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
      const bridgeEthereumNetwork = BridgeEthereum.networks[process.env.REACT_APP_NETID_ETH];
      const bridgeEthereum = new web3Eth.eth.Contract(BridgeEthereum.abi, bridgeEthereumNetwork && bridgeEthereumNetwork.address);
      const bridgeBscNetwork = BridgeBsc.networks[process.env.REACT_APP_NETID_BSC];
      const bridgeBsc = new web3Bsc.eth.Contract(BridgeBsc.abi, bridgeBscNetwork && bridgeBscNetwork.address);
      await initializeHelpers(await schnoodleEth.methods.decimals().call());

      let schnoodle, bridge, sourceNetwork;
      const chainId = await web3.eth.net.getId();

      switch (chainId.toString()) {
        case process.env.REACT_APP_NETID_ETH:
          schnoodle = new web3.eth.Contract(SchnoodleV9.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
          bridge = new web3.eth.Contract(BridgeEthereum.abi, bridgeEthereumNetwork && bridgeEthereumNetwork.address);
          sourceNetwork = Network.Ethereum;
          break;
        case process.env.REACT_APP_NETID_BSC:
          schnoodle = new web3.eth.Contract(SchnoodleV9.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
          bridge = new web3.eth.Contract(BridgeBsc.abi, bridgeBscNetwork && bridgeBscNetwork.address);
          sourceNetwork = Network.BSC;
          break;
        default:
      }

      const selectedAddress = web3.currentProvider.selectedAddress;
      const tokensReceived = await bridge.methods.tokensPending(selectedAddress).call();

      if (tokensReceived > 0) {
        const gasPay = localStorage.getItem('gasPay');
        if (gasPay != null) {
          this.setState({ gasPay: gasPay.split(',').map(x => Number(x)) });
        } else {
          this.setState({ gasPay: process.env.REACT_APP_SERVER_URLS.split(',').map(x => 15001 * Math.pow(10, 11)) });
        }
      }

      this.setState({ database, web3, chainId, web3Eth, web3Bsc, gasPrice, schnoodle, bridge, sourceNetwork, tokensReceived, schnoodleEthNetwork, schnoodleEth, schnoodleBscNetwork, schnoodleBsc, bridgeEthereumNetwork, bridgeEthereum, bridgeBscNetwork, bridgeBsc, selectedAddress }, () => {
        this.getFeesData();
      });
    } catch (err) {
      alert('Load error. Please check you are connected to the correct network in MetaMask.');
      console.error(err);
    }
  }

  async getFeesData() {
    const approveFeeRef = ref(this.state.database, '/fees');
    onValue(approveFeeRef, (snapshot) => {
      this.setState({ fees: snapshot.val() });
    });
  }

  isMetaMaskInstalled() {
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  }

  isMetaMaskConnected() {
    return this.state.selectedAddress != null;
  }

  //#region Error handling

  async fetch(input, init) {
    const result = await fetch(input, init);

    if (result.ok) {
      this.setState({ success: true, message: 'Operation successful' });
      return result;
    }

    throw new Error(result.statusText);
  }

  async handleResponse(response) {
    if (response.status) {
      this.setState({ success: true, message: response.transactionHash });
    }
  }

  handleError(err) {
    console.error(err);
    let message = err.message;

    if (err.message.includes('[ethjs-query] while formatting outputs from RPC')) {
      message = JSON.parse(err.message.match('(?<=\')(?:\\\\.|[^\'\\\\])*(?=\')')).value.data.message;
    }

    this.setState({ success: false, message });
    alert(message);
  }

  //#endregion

  async checkNetwork() {
    if (this.isMetaMaskInstalled()) {
      const { chainId, sourceNetwork } = this.state;
      this.clearMessage();

      if ((sourceNetwork === Network.BSC && chainId.toString() !== process.env.REACT_APP_NETID_BSC) ||
         (sourceNetwork === Network.Ethereum && chainId.toString() !== process.env.REACT_APP_NETID_ETH)) {
        this.setState({ success: false, message: `Please change selected network to ${sourceNetwork}.` });
      }
    }
  }

  async updateAllowance() {
    if (this.isMetaMaskInstalled() && this.isMetaMaskConnected()) {
      const { schnoodle, bridge, selectedAddress } = this.state;
      const allowance = schnoodle ? scaleDownUnits(await schnoodle.methods.allowance(selectedAddress, bridge.options.address).call({ from: selectedAddress })) : 0;
      this.setState({ allowance });
    }
  }

  async sendTokens() {
    const { allowance, amount } = this.state;

    if (allowance < amount) {
      // Allowance is insufficient; approve tokens
      const { database, schnoodle, bridge, selectedAddress, sourceNetwork } = this.state;
      this.checkServerStatus();
      this.setState({ busyApprove: true });

      await schnoodle.methods.approve(bridge.options.address, scaleUpUnits(amount).toString()).send({ from: selectedAddress })
        .on('receipt', function (receipt) {
          set(ref(database, `fees/${sourceNetwork.toLowerCase()}/approveFee`), receipt.gasUsed);
        })
        .on('transactionHash', async (hash) => {
          await waitForTransaction(hash);
          await this.updateAllowance();
          this.setState({ busyApprove: false });
          this.checkServerStatus();
        }).catch(err => {
          if (err.code === 4001) {
            this.setState({ busyApprove: false });
          }
        });
    } else {
      // Allowance is sufficient; send tokens
      const { database, bridge, selectedAddress, sourceNetwork, targetNetwork } = this.state;

      this.setState({ busySwap: true });

      const response = await bridge.methods.sendTokens(scaleUpUnits(amount).toString()).send({ from: selectedAddress })
        .on('receipt', function (receipt) {
          set(ref(database, `fees/${sourceNetwork.toLowerCase()}/sendFee`), receipt.gasUsed);
        })
        .on('transactionHash', async (hash) => {
          await waitForTransaction(hash);

          if (await writeTransactions.call(this)) {
            this.setState({ busySwap: false });
          } else {
            this.setState({ serverError: 'Remote server error' });
          }

          async function writeTransactions() {
            for (const server of process.env.REACT_APP_SERVER_URLS.split(',')) {
              if (!await writeTransaction.call(this, server)) {
                return false;
              }
            }

            return true;

            async function writeTransaction(server) {
              try {
                const serverResponse = await fetch(`http://${server}/WriteTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({ address: selectedAddress, targetNetwork })
                });

                if (serverResponse.ok) {
                  const json = await serverResponse.json();

                  switch (json.status) {
                    case 'error':
                      this.setState({ serverError: json.body.err.message });
                      break;
                    case 'busy':
                      await sleep(15000);
                      return await writeTransaction(server);
                    case 'ok': {
                      const gasPay = this.state.gasPay;
                      gasPay.push(json.body.gas);
                      this.setState({ gasPay });
                      localStorage.setItem('gasPay', gasPay);
                      return true;
                    }
                    default:
                      throw 'Invalid response';
                  }
                } else {
                  console.log(`Error HTTP: ${serverResponse.status}`);
                }
              } catch (err) {
                await sleep(15000);
                return await writeTransaction(server);
              }

              return false;
            }
          }
        }).catch(err => {
          if (err.code === 4001) {
            this.setState({ busySwap: false });
          }
        });

      this.handleResponse(response);
    }
  }

  async receiveTokens() {
    const { bridge, selectedAddress, sourceNetwork, gasPay, database, web3 } = this.state;
    this.checkServerStatus();

    this.setState({ busyReceive: true });

    let sum = gasPay.reduce((a, b) => a + b, 0);

    if (sum <= gasPay.length * 150000 * 1e9) {
      sum = gasPay.length * 150001 * 1e9;
    }

    sum = sum.toFixed(0);
    const gasPrice = await web3.eth.getGasPrice();

    await bridge.methods.receiveTokens(gasPay).send({ from: selectedAddress, value: sum.toString(), gasPrice })
      .on('receipt', function (receipt) {
        set(ref(database, `fees/${sourceNetwork.toLowerCase()}/receiveFee`), receipt.gasUsed + sum / gasPrice);
      })
      .on('transactionHash', async (hash) => {
        await waitForTransaction(hash);
        this.setState({ hash: hash, busyReceive: false, showClose: true, gasPay: [] });
      }).catch(err => {
        if (err.code === 4001) {
          this.setState({ busyReceive: false });
        }
      });
  }

  clearMessage() {
    this.setState({ message: null });
  }

  close() {
    this.clearMessage();
    this.setState({ showClose: false, amount: 0, tokensReceived: 0 });
  }

  resetAllowance() {
    this.setState({ allowance: 0 });
  }

  handleFaq() {
    localStorage.setItem('info', 'faq');
  }

  handleGuide() {
    localStorage.setItem('info', 'guide');
  }

  async checkServerStatus() {
    const urlArray = process.env.REACT_APP_SERVER_URLS.split(',');
    for (let i = 0; i < urlArray.length; i++) {
      const response = await fetch(`http://${urlArray[i]}/CheckServer`).catch(function (err) {
        console.log(err);
        this.setState({ serverStatus: false });
      }.bind(this));

      if (response != null) {
        if (response.ok) {
          const json = await response.json();
          console.log(json.response);
        } else {
          console.log(`Error HTTP: ${response.status}`);
          this.setState({ serverStatus: false });
        }
      }
    }
  }

  async changeSourceNetwork(e) {
    const { web3, schnoodleEthNetwork, schnoodleBscNetwork, bridgeBscNetwork, bridgeEthereumNetwork } = this.state;
    const sourceNetwork = e.value;
    let schnoodle, bridge;

    switch (sourceNetwork) {
      case Network.Ethereum:
      {
        schnoodle = new web3.eth.Contract(SchnoodleV9.abi, schnoodleEthNetwork.address);
        bridge = new web3.eth.Contract(BridgeEthereum.abi, bridgeEthereumNetwork.address);
        break;
      }
      case Network.BSC:
      {
        schnoodle = new web3.eth.Contract(SchnoodleV9.abi, schnoodleBscNetwork.address);
        bridge = new web3.eth.Contract(BridgeBsc.abi, bridgeBscNetwork.address);
        break;
      }
    }

    await this.clearMessage();
    this.setState({ sourceNetwork, schnoodle, bridge, typeSwap: '' }, async () => {
      await this.updateAllowance();
    });
    console.log(e.value);
  }

  async changeTargetNetwork(e) {
    const typeSwap = this.state.sourceNetwork + 'to' + e.value;
    this.setState({ typeSwap, targetNetwork: e.value });
    console.log(typeSwap);
    if (this.isMetaMaskConnected()) {
      await this.checkNetwork();
    }
  }

  async updateAmount(e) {
    const amount = Number(e.target.value);
    if (!Number.isInteger(amount)) return;
    this.setState({ amount }, async () => await this.updateAllowance());

    const { schnoodleEth, schnoodleBsc, bridgeEthereum, bridgeBsc, chainId, selectedAddress } = this.state;

    if (this.isMetaMaskInstalled() && this.isMetaMaskConnected()) {
      if (!isNaN(+amount)) {
        if (chainId.toString() === process.env.REACT_APP_NETID_ETH) {
          await checkBalance.call(this, schnoodleEth, schnoodleBsc, bridgeBsc);
        } else if (chainId.toString() === process.env.REACT_APP_NETID_BSC) {
          await checkBalance.call(this, schnoodleBsc, schnoodleEth, bridgeEthereum);
        }

        async function checkBalance(schnoodle, schnoodleOther, bridgeOther) {
          const otherBridgeBalance = await schnoodleOther.methods.balanceOf(bridgeOther.options.address).call();

          const decimals = await schnoodle.methods.decimals().call();
          const currentBalance = await schnoodle.methods.balanceOf(selectedAddress).call();
          let message = null;

          if (parseFloat(amount) * Math.pow(10, decimals) > currentBalance) {
            message = 'Insufficient tokens for transaction';
          } else if (parseFloat(amount) * Math.pow(10, decimals) > otherBridgeBalance) {
            message = 'Insufficient tokens on TODO bridge';
          } else if (parseFloat(amount) < Math.pow(10, -decimals)) {
            message = 'Token amount below minimum';
          }
          this.setState({ success: false, message });
        }
      } else {
        this.setState({ success: false, message: 'Incorrect input' });
      }
    }
  }

  render() {
    const { sourceNetwork, targetNetwork, busyApprove, busySwap, busyReceive, allowance, showClose, gasPrice, tokensReceived, fees, amount, selectedAddress, serverStatus, serverError, hash, typeSwap, message } = this.state;

    const sourceNetworks = [
      { value: Network.BSC, label: 'BEP20' },
      { value: Network.Ethereum, label: 'ERC20' }
    ];
    const targetNetworks = sourceNetworks.filter(source => source.value !== sourceNetwork);

    const styles = {
      valueContainer: () => ({ width: 60 }),
      singleValue: base => ({ ...base, color: '#dc20bc' }),
      control: (base, state) => ({ ...base, background: '#070c39', border: 'none' }),
      dropdownIndicator: base => ({ ...base, color: '#dc20bc' }),
      menuList: base => ({ ...base, background: '#070c39', color: '#dc20bc' }),
      option: (provided, state) => ({ ...provided, color: state.isSelected || state.isFocused ? '#dc20bc' : '#6f1860', background: '#070c39' })
    }

    const busyMessage = busyApprove
        ? resources.BUSY_MESSAGE_APPROVE
        : busySwap
        ? resources.BUSY_MESSAGE_SWAP
        : busyReceive
        ? resources.BUSY_MESSAGE_RECEIVE
        : null;

    const displayFee = (fee, symbol) => `~ ${((fee ?? 0) * gasPrice).toFixed(6).toString()} ${symbol}`;
    const displayAccount = selectedAddress ? selectedAddress.slice(0, 6) + '...' + selectedAddress.slice(-6) : '';

    let bridge;
    if (busyMessage) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <img src="/assets/img/svg/load.svg" alt="" className="w-16 h-16 mb-8 lg:mb-11 animate-spin" />
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">{busyMessage}</div>
      </div>;
    } else if (showClose) {
      bridge = <div className="col-span-7 lg:bg-main-bg bg-transparent lg:py-40 pt-10 lg:px-14 px-4 rounded-xl flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="flex items-center flex-col text-2xl lg:text-3xl">
          <div className="text-center mb-9 leading-normal">We sent you <span className="text-main-color font-medium">{tokensReceived}</span> <span className="font-bold">{`SNOOD to the ${sourceNetwork} network`}</span> at address <span><a className="text-main-color font-medium underline transition-all duration-200 hover:text-main-color-hover">{displayAccount}</a></span></div>
          <div className="text-lg mb-16 lg:mb-5 text-center">You can track the transaction <a href={sourceNetwork === Network.BSC ? `http://testnet.bscscan.com/tx/${hash}` : (`http://rinkeby.etherscan.io/tx/${hash}`)} target="_blank" rel="noreferrer" className="text-main-color transition-all duration-200 hover:text-main-color-hover hover:underline">here</a></div>
          <button onClick={this.close} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">CLOSE</button>
        </div>
      </div>;
    } else if (!serverStatus) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">Service is now unavailable</div>
      </div>;
    } else if (serverError != null) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">{`Remote server error: ${serverError}`}</div>
      </div>;
    } else if (tokensReceived > 0) {
      bridge = <div className="col-span-7 lg:bg-main-bg lg:py-40 pt-10 lg:px-14 px-4 rounded-xl bg-transparent flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="text-center mb-14 leading-normal">
          <span className="text-main-color font-medium">{scaleDownUnits(tokensReceived)}</span> <span className="font-bold">{`SNOOD ready to be received on ${sourceNetwork} network`}</span> at <span><div className="text-main-color hover:text-main-color-hover font-medium underline transition-all duration-200">{displayAccount}</div></span>
        </div>
        <button onClick={this.receiveTokens} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">RECEIVE</button>
      </div>;
    } else {
      bridge =
        <div className="col-span-7 lg:px-6 lg:py-10 rounded-13 lg:bg-main-bg bg-transparent">
          <div className="flex items-center lg:mb-9 mb-6 flex-col lg:flex-row">
            <div className="w-full lg:w-5/12 p-5 lg:p-0 rounded-xl bg-second-bg lg:bg-transparent">
              <div className="font-bold text-xs lg:mb-4 text-main-color">From</div>
              <div className="flex items-center justify-between lg:p-4 bg-second-bg rounded-lg">
                <div>
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">SNOOD</div>
                  <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(e => e.value === sourceNetwork)} onChange={this.changeSourceNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="rounded-full w-16 h-16 flex justify-center items-center"><img src="/assets/img/png/logo-krypto.png" alt="" /></div>
              </div>
            </div>
            <button className="p-2 bg-main-color w-10 h-10 lg:mx-6 rounded-10 outline-none focus:outline-none -mt-3 lg:mt-7 relative z-20 lg:static transform rotate-90 lg:transform-none">
              <img className="block w-5 h-5 mx-auto" src="/assets/img/svg/arrows.svg" alt="" />
            </button>
            <div className="w-full lg:w-5/12 relative -top-3 lg:static bg-second-bg lg:bg-transparent p-5 lg:p-0 rounded-xl">
              <div className="font-bold text-xs lg:mb-4 text-main-color">To</div>
              <div className="flex items-center justify-between lg:p-5 bg-second-bg rounded-lg">
                <div>
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">SNOOD</div>
                  <Select styles={styles} options={targetNetworks} value={targetNetworks.find(e => e.value === targetNetwork)} onChange={this.changeTargetNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="w-16 h-16 flex justify-center items-center rounded-full"><img src="/assets/img/png/logo-krypto.png" alt="" /></div>
              </div>
            </div>
          </div>
          <div className="opacity-50 text-white md:text-base mb-4 tracking-wide text-xs">Details</div>
          <div className="flex flex-col border-solid mb-10 lg:mb-16">
            <input type="number" min="1" placeholder="Amount" value={amount || ''} onChange={this.updateAmount} className="w-full text-white bg-third-bg rounded-md text-sm border border-border p-3.5 font-medium outline-none focus:outline-none" />
          </div>
          <button onClick={this.sendTokens} disabled={typeSwap === '' || message != null || !this.isMetaMaskInstalled() || !this.isMetaMaskConnected() || amount === 0} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">{allowance < amount ? 'Approve' : 'Send'}</button>
          <div className="text-center mt-2.5">
            <p style={{ color: this.state.success ? 'green' : 'red' }}>{message}</p>
          </div>
        </div>;
    }

    return (
      <div className="font-Roboto flex flex-col min-h-screen bg-body">
        <header className="bg-header relative z-50">
          <div className="container">
            <div className="flex justify-between py-3 items-center w-full">
              <div className="relative w-8 h-8 lg:hidden"><button className="burger outline-none focus:outline-none"></button></div>
              <a href="/"><img className="w-40 h-auto" src="/assets/img/svg/logo-schnoodle.svg" alt="" /></a>
              <ConnectWallet updateAllowance={this.updateAllowance} resetAllowance={this.resetAllowance} checkNetwork={this.checkNetwork} clearMessage={this.clearMessage} />
            </div>
          </div>
        </header>

        <div className="lg:py-16 py-10 flex-grow">
          <div className="container">
            <div className="lg:grid grid-cols-12 block">
              <div className="col-span-5 rounded-13 lg:px-8 lg:mr-8 lg:py-10 lg:bg-main-bg bg-transparent relative">
                <div className="text-3xl lg:mb-8 mb-4 text-gradient bg-gradient-to-r from-purple-from to-purple-to">Schnoodle Bridge</div>
                <div className="lg:mb-8 mb-4 text-white">The bridge allows to exchange ERC20 tokens for BEP20 tokens as well as BEP20 for ERC20</div>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl transition-all duration-200 hover:text-main-color-hover"
                  href="/info" onClick={() => this.handleGuide()}>Token exchange guide</a>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl transition-all duration-200 hover:text-main-color-hover"
                  href="/info" onClick={() => this.handleFAQ()}>FAQ</a>
                <div className="flex font-bold text-second-color lg:mb-8 mb-2 text-xl items-center">Fees
                </div>
                <div className="flex text-main-text mb-1.5">
                  Approve:
                  <div className="ml-1.5 text-white">{sourceNetwork === Network.Ethereum ? displayFee(fees?.ethereum.approveFee, 'ETH') : displayFee(fees?.bsc.approveFee, 'BNB')}</div>
                </div>
                <div className="flex text-main-text mb-1.5">
                  Send:
                  <div className="ml-1.5 text-white">{sourceNetwork === Network.Ethereum ? displayFee(fees?.ethereum.sendFee, 'ETH') : displayFee(fees?.bsc.sendFee, 'BNB')}</div>
                </div>
                <div className="flex text-main-text mb-7">
                  Receive:
                  <div className="ml-1.5 text-white">{targetNetwork === Network.BSC ? displayFee(fees?.bsc.receiveFee, 'BNB') : displayFee(fees?.ethereum.receiveFee, 'ETH')}</div>
                </div>
              </div>
              {bridge}
            </div>
          </div>
        </div>

        <footer className=" hidden lg:block bg-main-bg h-9" />

        <div className="burger-list bg-main-bg mr-20 h-auto p-8 pt-24 pb-0 fixed top-0 left-0 z-30 overflow-y-auto h-full">
          <div className="text-2xl lg:text-3xl mb-16 block text-white">Schnoodle Bridge</div>
          <a className="font-bold text-xl text-main-color mb-8 block" href="/">Main Page</a>
          <a href="/info" className="font-bold text-xl text-second-color mb-8 block" onClick={() => this.handleGuide()}>Token exchange guide</a>
          <a href="/info" className="font-bold text-xl text-second-color mb-8 block" onClick={() => this.handleFAQ()}>FAQ</a>
        </div>
      </div>
    );
  }
}
