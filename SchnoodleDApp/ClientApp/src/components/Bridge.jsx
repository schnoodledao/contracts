import React, { Component } from 'react';
import { bridge as resources } from '../resources';
import './Bridge.css'
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import SchnoodleV8 from '../contracts/SchnoodleV8.json';
import BridgeEthereum from '../contracts/BridgeEthereum.json';
import BridgeBsc from '../contracts/BridgeBsc.json';
import getWeb3 from '../getWeb3';
import { ConnectWallet } from './ConnectWallet';
import { initializeHelpers, scaleUpUnits, scaleDownUnits, createEnum, waitForTransaction } from '../helpers';

// Third-party libraries
import $ from 'jquery';
import Web3 from 'web3';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { BigNumber } from 'bignumber.js';
import Select from 'react-select';

const Network = createEnum(['Ethereum', 'BSC']);

export class Bridge extends Component {
  static displayName = Bridge.name;

  constructor(props) {
    super(props);

    this.state = {
      busyApprove: false,
      busySwap: false,
      busyReceive: false,
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
      Token: null,
      allowance: 0,
      database: null,
      fees: null,
      showReceive: false,
      amountToSend: 0,
      chainId: 0,
      hash: '',
      serverStatus: true,
      showEnd: false,
      serverError: null,
      gasPay: [],
      apiRequestAmount: 0,
      sourceNetwork: '',
      targetNetwork: '',
      typeSwap: '',
      errorMessage: null,
      amount: null
    }

    this.updateAllowance = this.updateAllowance.bind(this);
    this.sendTokens = this.sendTokens.bind(this);
    this.resetApprove = this.resetApprove.bind(this);
    this.changeSourceNetwork = this.changeSourceNetwork.bind(this);
    this.changeTargetNetwork = this.changeTargetNetwork.bind(this);
    this.updateAmount = this.updateAmount.bind(this);
  }

  async componentDidMount() {
    try {
      this.checkServerStatus();

      // If the internet is dead it will show the recap again
      if (localStorage.getItem('showReceive') === 'true') {
        if (localStorage.getItem('accountToSend') != null) {
          this.setState({ accountToSend: localStorage.getItem('accountToSend') });
        }

        if (localStorage.getItem('amountToSend') != null) {
          this.setState({ amountToSend: localStorage.getItem('amountToSend') });
        }

        if (localStorage.getItem('typetrade') != null) {
          this.setState({ targetNetwork: localStorage.getItem('typetrade') });
        }

        if (localStorage.getItem('gasPay') != null) {
          let arrNumber = [];
          let arr = localStorage.getItem('gasPay').split(',');
          for (let i = 0; i < arr.length; i++) {
            arrNumber.push(Number(arr[i]));
          }
          this.setState({ gasPay: arrNumber });
        } else {
          let arr = [];
          let gas = 15001 * Math.pow(10, 11);
          for (let i = 0; i < process.env.REACT_APP_SERVER_URLS.split(',').length; i++) {
            arr.push(gas);
          }
          this.setState({ gasPay: arr });
        }

        this.setState({ showReceive: true });
      }

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
      const schnoodleEth = new web3Eth.eth.Contract(SchnoodleV8.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = SchnoodleV1.networks[process.env.REACT_APP_NETID_BSC];
      const schnoodleBsc = new web3Bsc.eth.Contract(SchnoodleV8.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
      const bridgeEthereumNetwork = BridgeEthereum.networks[process.env.REACT_APP_NETID_ETH];
      const bridgeEthereum = new web3Eth.eth.Contract(BridgeEthereum.abi, bridgeEthereumNetwork && bridgeEthereumNetwork.address);
      const bridgeBscNetwork = BridgeBsc.networks[process.env.REACT_APP_NETID_BSC];
      const bridgeBsc = new web3Bsc.eth.Contract(BridgeBsc.abi, bridgeBscNetwork && bridgeBscNetwork.address);
      await initializeHelpers(await schnoodleEth.methods.decimals().call());

      this.setState({ database, web3, web3Eth, web3Bsc, gasPrice, schnoodleEthNetwork, schnoodleEth, schnoodleBscNetwork, schnoodleBsc, bridgeEthereumNetwork, bridgeEthereum, bridgeBscNetwork, bridgeBsc, selectedAddress: web3.currentProvider.selectedAddress }, () => {
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
    return localStorage.getItem('account') && localStorage.getItem('account').length > 0;
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

    await this.getInfo();
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
      const { web3, sourceNetwork } = this.state;
      this.resetErrorsFunc();
      const chainId = await web3.eth.net.getId();

      if ((sourceNetwork === Network.BSC && chainId.toString() !== process.env.REACT_APP_NETID_BSC) ||
         (sourceNetwork === Network.Ethereum && chainId.toString() !== process.env.REACT_APP_NETID_ETH)) {
        this.setState({ errorMessage: `Please change selected network to ${sourceNetwork}.` });
      }
    }
  }

  async updateAllowance() {
    if (this.isMetaMaskInstalled() && this.isMetaMaskConnected()) {
      const account = localStorage.getItem('account');
      const { schnoodle, bridge } = this.state;
      const allowance = schnoodle ? scaleDownUnits(await schnoodle.methods.allowance(account, bridge.options.address).call({ from: account })) : 0;
      this.setState({ allowance });
    }
  }

  async sendTokens() {
    const { allowance, amount } = this.state;

    if (allowance < amount) {
      // Allowance is insufficient; approve tokens
      const { database, schnoodle, bridge, sourceNetwork } = this.state;
      this.checkServerStatus();
      this.setState({ busyApprove: true });

      await schnoodle.methods.approve(bridge.options.address, scaleUpUnits(amount).toString()).send({ from: localStorage.getItem('account') })
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
      const { database, bridge, sourceNetwork, targetNetwork, apiRequestAmount, serverError } = this.state;
      const account = localStorage.getItem('account');
      localStorage.setItem('amountToSend', amount);
      localStorage.setItem('typetrade', this.state.targetNetwork);
      this.setState({ account, amountToSend: amount, busySwap: true });

      const am = scaleUpUnits(amount).toString();
      const response1 = await bridge.methods.sendTokens(am).send({ from: account });

      const response = await bridge.methods.sendTokens(scaleUpUnits(amount).toString()).send({ from: account })
        .on('receipt', function (receipt) {
          set(ref(database, `fees/${sourceNetwork.toLowerCase()}/sendFee`), receipt.gasUsed);
        })
        .on('transactionHash', async (hash) => {
          await waitForTransaction(hash);
          await this.apiRequestFunc(localStorage.getItem('account'), sourceNetwork, targetNetwork);

          const urlArray = process.env.REACT_APP_SERVER_URLS.split(',');
          console.log(apiRequestAmount);

          if (apiRequestAmount !== urlArray.length) {
            localStorage.setItem('showReceive', false);
            this.setState({ serverError: 'Remote server error', apiRequestAmount: 0 });
          } else {
            this.setState({ apiRequestAmount: 0, busySwap: false });
            if (serverError === null) {
              this.setState({ showReceive: true });
              localStorage.setItem('showReceive', true);
            }
          }
        }).catch(err => {
          if (err.code === 4001) {
            localStorage.setItem('showReceive', false);
            this.setState({ busySwap: false });
          }
        });

      this.handleResponse(response);
    }
  }

  async receiveTokens() {
    const { targetNetwork, bridge } = this.state;
    this.checkServerStatus();

    this.setState({ busyReceive: true });
    const { gasPay, database, web3 } = this.state;

    this.changeChainId();
    const arrGas = gasPay;
    let sum = 0;
    for (let i = 0; i < arrGas.length; i++) {
      sum += arrGas[i];
    }
    if (sum <= arrGas.length * 150000 * Math.pow(10, 9)) {
      sum = arrGas.length * 150001 * Math.pow(10, 9);
    }
    sum = sum.toFixed(0);
    const amount = sum.toString();
    console.log(amount);
    console.log(sum);
    const gasPrice = await web3.eth.getGasPrice();

    await bridge.methods.receiveTokens(arrGas).send({ from: localStorage.getItem('account'), value: amount, gasPrice: web3.eth.gasPrice })
      .on('receipt', function (receipt) {
        set(ref(database, `fees/${targetNetwork.toLowerCase()}/receiveFee`), receipt.gasUsed + sum / gasPrice);
      })
      .on('transactionHash', async (hash) => {
        await waitForTransaction(hash);
        localStorage.setItem('showReceive', false);
        this.setState({ hash: hash, busyReceive: false, showReceive: false, showEnd: true, gasPay: [] });
      }).catch(err => {
        if (err.code === 4001) {
          this.setState({ busyReceive: false, showReceive: true });
          localStorage.setItem('showReceive', true);
        }
      });
  }

  async resetErrorsFunc() {
    this.setState({ errorMessage: null });
  }

  async apiRequestFunc(account, typeSwap, typeReceive) {
    const urlArray = process.env.REACT_APP_SERVER_URLS.split(',');
    for (let i = 0; i < urlArray.length; i++) {
      await this.apiOneRequest(urlArray[i], account, typeSwap, typeReceive);
    }
  }

  async apiOneRequest(server, account, typeSwap, typeReceive) {
    try {
      const response = await fetch(`http://${server}/WriteTransaction`, {
        method: 'POST',
        body: JSON.stringify({ address: account, typeSwap: typeSwap, typeReceive: typeReceive }),
      });
      if (response.ok) {
        const json = await response.json();
        console.log(json.response);
        if (json.response === 'error') {
          localStorage.setItem('showReceive', false);
          this.setState({ serverError: json.error });
        }
        if (json.response === 'busy') {
          await new Promise(resolve => setTimeout(resolve, 15000));
          this.apiOneRequest(server, account, typeSwap, typeReceive);
        } else {
          const amount = this.state.apiRequestAmount + 1;
          console.log(amount);
          this.setState({ apiRequestAmount: amount });
        }

        const array = this.state.gasPay;
        array.push(json.gas);
        this.setState({ gasPay: array });
        localStorage.setItem('gasPay', array);
      } else {
        localStorage.setItem('showReceive', false);
        console.log(`Error HTTP: ${response.status}`);
      }
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      this.apiOneRequest(server, account, typeSwap);
    }
  }

  endButton() {
    this.setState({ amount: null });
    this.resetErrorsFunc();
    this.firstNetReset();
    this.setState({ showEnd: false });
  }

  resetApprove() {
    this.setState({ allowance: 0, chainId: 0 });
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
        schnoodle = new web3.eth.Contract(SchnoodleV8.abi, schnoodleEthNetwork.address);
        bridge = new web3.eth.Contract(BridgeEthereum.abi, bridgeEthereumNetwork.address);
        break;
      }
      case Network.BSC:
      {
        schnoodle = new web3.eth.Contract(SchnoodleV8.abi, schnoodleBscNetwork.address);
        bridge = new web3.eth.Contract(BridgeBsc.abi, bridgeBscNetwork.address);
        break;
      }
    }

    await this.resetErrorsFunc();
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

  firstNetReset() {
    this.setState({ sourceNetwork: '' });
  }

  async updateAmount(e) {
    const amount = Number(e.target.value);
    if (!Number.isInteger(amount)) return;
    this.setState({ amount }, async () => await this.updateAllowance());

    const { schnoodleEth, schnoodleBsc, bridgeEthereum, bridgeBsc, chainId } = this.state;

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
          const currentBalance = await schnoodle.methods.balanceOf(localStorage.getItem('account')).call();
          let errorMessage = null;

          if (parseFloat(amount) * Math.pow(10, decimals) > currentBalance) {
            errorMessage = 'Insufficient tokens for transaction';
          } else if (parseFloat(amount) * Math.pow(10, decimals) > otherBridgeBalance) {
            errorMessage = 'Insufficient tokens on TODO bridge';
          } else if (parseFloat(amount) < Math.pow(10, -decimals)) {
            errorMessage = 'Token amount below minimum';
          }
          this.setState({ errorMessage });
        }
      } else {
        this.setState({ errorMessage: 'Incorrect input' });
      }
    }
  }

  render() {
    const { sourceNetwork, targetNetwork, busyApprove, busySwap, busyReceive, allowance, showReceive, showEnd, gasPrice, fees, amountToSend, amount, account, serverStatus, serverError, chainId, hash, typeSwap, errorMessage } = this.state;

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
    const displayAccount = account ? account.slice(0, 6) + '...' + account.slice(-6) : '';

    let bridge;
    if (busyMessage) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <img src="/assets/img/svg/load.svg" alt="" className="w-16 h-16 mb-8 lg:mb-11 animate-spin" />
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">{busyMessage}</div>
      </div>;
    } else if (showEnd) {
      bridge = <div className="col-span-7 lg:bg-main-bg bg-transparent lg:py-40 pt-10 lg:px-14 px-4 rounded-xl flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="flex items-center flex-col text-2xl lg:text-3xl">
          <div className="text-center mb-9 leading-normal">We sent you <span className="text-main-color font-medium">{amountToSend}</span> <span className="font-bold">{`SNOOD ${targetNetwork === 'MATIC' ? 'MATIC' : (targetNetwork + '20')}`}</span> tokens to the address <span>
            <a className="text-main-color font-medium underline transition-all duration-200 hover:text-main-color-hover">{displayAccount}</a></span></div>
          <div className="text-lg mb-16 lg:mb-5 text-center">You can track the transaction: <a href={targetNetwork === Network.BSC ? `http://testnet.bscscan.com/tx/${hash}` : targetNetwork === 'MATIC' ? `http://polygonscan.com/tx/${hash}` : (`http://kovan.etherscan.io/tx/${hash}`)} target="_blank" rel="noreferrer"
            className="text-main-color transition-all duration-200 hover:text-main-color-hover hover:underline">link</a>
          </div>
          <button onClick={this.endButton} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
            END
          </button>
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
    } else if (showReceive) {
      bridge = <div className="col-span-7 lg:bg-main-bg lg:py-40 pt-10 lg:px-14 px-4 rounded-xl bg-transparent flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="text-center mb-14 leading-normal">
          You will receive <span className="text-main-color font-medium">{amountToSend}</span> <span className="font-bold">{`SNOOD ${targetNetwork === 'MATIC' ? 'MATIC' : (targetNetwork + '20')}`}</span> tokens at <span><div className="text-main-color hover:text-main-color-hover font-medium underline transition-all duration-200">{displayAccount}</div></span>
        </div>
        {targetNetwork === Network.Ethereum ? (chainId.toString() === process.env.REACT_APP_NETID_ETH ? <button onClick={() => this.receiveTokens()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokens} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>) : targetNetwork === Network.BSC ? (chainId.toString() === process.env.REACT_APP_NETID_BSC ? <button onClick={() => this.receiveTokens()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokens} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>) : (chainId.toString() === process.env.REACT_APP_NETID_MATIC ? <button onClick={() => this.receiveTokens()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokens} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>)}
        {targetNetwork === Network.Ethereum ? (chainId.toString() === process.env.REACT_APP_NETID_ETH ? null : <div className="text-center text-sm mt-2.5">Swap to ETH network</div>) : targetNetwork === Network.BSC ? (chainId.toString() === process.env.REACT_APP_NETID_BSC ? null : <div className="text-center text-sm mt-2.5">Swap to BSC network</div>) : (chainId.toString() === process.env.REACT_APP_NETID_MATIC ? null : <div className="text-center text-sm mt-2.5">Swap to MATIC network</div>)}
      </div>;
    } else {
      bridge =
        <div className="col-span-7 lg:px-6 lg:py-10 rounded-13 lg:bg-main-bg bg-transparent">
          <div className="flex items-center lg:mb-9 mb-6 flex-col lg:flex-row">
            <div className="w-full lg:w-5/12 p-5 lg:p-0 rounded-xl bg-second-bg lg:bg-transparent">
              <div className="font-bold text-xs lg:mb-4 text-main-color">From</div>
              <div className="flex items-center justify-between lg:p-4 bg-second-bg rounded-lg">
                <div>
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">
                    SNOOD
                  </div>
                  <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(e => e.value === sourceNetwork)} onChange={this.changeSourceNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="rounded-full w-16 h-16 flex justify-center items-center">
                  <img src="/assets/img/png/logo-krypto.png" alt="" />
                </div>
              </div>
            </div>
            <button className="p-2 bg-main-color w-10 h-10 lg:mx-6 rounded-10 outline-none focus:outline-none -mt-3 lg:mt-7 relative z-20 lg:static transform rotate-90 lg:transform-none">
              <img className="block w-5 h-5 mx-auto" src="/assets/img/svg/arrows.svg" alt="" />
            </button>
            <div className="w-full lg:w-5/12 relative -top-3 lg:static bg-second-bg lg:bg-transparent p-5 lg:p-0 rounded-xl">
              <div className="font-bold text-xs lg:mb-4 text-main-color">To</div>
              <div className="flex items-center justify-between lg:p-5 bg-second-bg rounded-lg">
                <div>
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">
                    SNOOD
                  </div>
                  <Select styles={styles} options={targetNetworks} value={targetNetworks.find(e => e.value === targetNetwork)} onChange={this.changeTargetNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="w-16 h-16 flex justify-center items-center rounded-full">
                  <img src="/assets/img/png/logo-krypto.png" alt="" />
                </div>
              </div>
            </div>
          </div>
          <div className="opacity-50 text-white md:text-base mb-4 tracking-wide text-xs">Details</div>
          <div className="flex flex-col border-solid mb-10 lg:mb-16">
            <input type="number" min="1" placeholder="Amount" value={amount || ''} onChange={this.updateAmount} className="w-full text-white bg-third-bg rounded-md text-sm border border-border p-3.5 font-medium outline-none focus:outline-none" />
          </div>
          <button onClick={this.sendTokens} disabled={typeSwap === '' || errorMessage != null || !this.isMetaMaskInstalled() || !this.isMetaMaskConnected() || amount === 0} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">{allowance < amount ? 'Approve' : 'Send'}</button>
          <div className="text-center text-red-500 mt-2.5">{errorMessage}</div>
        </div>;
    }

    return (
      <div className="font-Roboto flex flex-col min-h-screen bg-body">
        <header className="bg-header relative z-50">
          <div className="container">
            <div className="flex justify-between py-3 items-center w-full">
              <div className="relative w-8 h-8 lg:hidden">
                <button className="burger outline-none focus:outline-none"></button>
              </div>
              <a href="/">
                <img className="w-40 h-auto" src="/assets/img/svg/logo-schnoodle.svg" alt="" />
              </a>
              <ConnectWallet updateAllowance={this.updateAllowance} resetApprove={this.resetApprove} changeChainId={this.changeChainId} checkNetwork={this.checkNetwork} resetErrorsFunc={this.resetErrorsFunc} />
            </div>
          </div>
        </header>

        <div className="lg:py-16 py-10 flex-grow">
          <div className="container">
            <div className="lg:grid grid-cols-12 block">
              <div className="col-span-5 rounded-13 lg:px-8 lg:mr-8 lg:py-10 lg:bg-main-bg bg-transparent relative">
                <div className="text-3xl lg:mb-8 mb-4 text-gradient bg-gradient-to-r from-purple-from to-purple-to">Schnoodle Bridge</div>
                <div className="lg:mb-8 mb-4 text-white">The bridge allows to exchange ERC20 tokens for BEP20 tokens as well as BEP20 for ERC20
                  {/* MATIC */}
                </div>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl transition-all duration-200 hover:text-main-color-hover"
                  href="/info" onClick={() => this.handleGuide()}>Token exchange guide</a>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl  transition-all duration-200 hover:text-main-color-hover"
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
