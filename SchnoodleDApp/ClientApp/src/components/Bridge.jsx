import React, { Component } from 'react';
import './Bridge.css'
import { ConnectWallet } from './ConnectWallet';
import $ from 'jquery';
import getWeb3 from '../getWeb3';
import Web3 from 'web3';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import SchnoodleV8 from '../contracts/SchnoodleV8.json';
import BridgeEthereum from '../contracts/BridgeEthereum.json';
import BridgeBsc from '../contracts/BridgeBsc.json';

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

import { BigNumber } from 'bignumber.js';
import Select from 'react-select';

const expectedBlockTime = 1000;

export class Bridge extends Component {
  constructor(props) {
    super(props);

    this.state = {
      bridge: 'BEPtoERC',
      loading: false,
      loadingApprove: false,
      web3: null,
      web3Eth: null,
      web3Bsc: null,
      schnoodleEth: null,
      schnoodleBsc: null,
      bridgeEthereum: null,
      bridgeBsc: null,
      Token: null,
      approvedEth: false,
      approvedBsc: false,
      database: null,
      ethApproveFee: 0,
      ethSendFee: 0,
      ethReceiveFee: 0,
      bscApproveFee: 0,
      bscSendFee: 0,
      bscReceiveFee: 0,
      showReceive: false,
      accountToSend: 0x0,
      amountToSend: 0,
      chainId: 0,
      hash: '',
      serverStatus: true,
      loadingReceive: false,
      showEnd: false,
      serverError: null,
      gasPay: [],
      apiRequestAmount: 0,
      firstNet: '',
      secondNet: '',
      typeSwap: '',
      errorMessage: null,
      amount: null,
      errorMessageSend: null
    }
  }

  isMetaMaskInstalled() {
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  }

  isMetaMaskConnected() {
    return localStorage.getItem('account') && localStorage.getItem('account').length > 0;
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
          this.setState({ secondNet: localStorage.getItem('typetrade') });
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

      // Smart contracts
      const schnoodleEthDeployedNetwork = SchnoodleV1.networks[process.env.REACT_APP_NETID_ETH];
      const schnoodleEth = new web3Eth.eth.Contract(SchnoodleV8.abi, schnoodleEthDeployedNetwork && schnoodleEthDeployedNetwork.address);
      const schnoodleBscDeployedNetwork = SchnoodleV1.networks[process.env.REACT_APP_NETID_BSC];
      const schnoodleBsc = new web3Bsc.eth.Contract(SchnoodleV8.abi, schnoodleBscDeployedNetwork && schnoodleBscDeployedNetwork.address);
      const bridgeEthereumDeployedNetwork = BridgeEthereum.networks[process.env.REACT_APP_NETID_ETH];
      const bridgeEthereum = new web3Eth.eth.Contract(BridgeEthereum.abi, bridgeEthereumDeployedNetwork && bridgeEthereumDeployedNetwork.address);
      const bridgeBscDeployedNetwork = BridgeBsc.networks[process.env.REACT_APP_NETID_BSC];
      const bridgeBsc = new web3Bsc.eth.Contract(BridgeBsc.abi, bridgeBscDeployedNetwork && bridgeBscDeployedNetwork.address);

      this.setState({ database, web3, web3Eth, web3Bsc, schnoodleEth, schnoodleBsc, bridgeEthereum, bridgeBsc, selectedAddress: web3.currentProvider.selectedAddress }, () => {
        this.getApproveInfo();
        this.getEthFeeInfo();
        this.getBnbFeeInfo();
      });
    } catch (err) {
      alert('Load error. Please check you are connected to the correct network in MetaMask.');
      console.error(err);
    }
  }

  async getApproveInfo() {
    const { schnoodleEth, schnoodleBsc } = this.state;

    if (this.isMetaMaskInstalled() && this.isMetaMaskConnected()) {
      const account = localStorage.getItem('account');
      await this.changeChainId();

      if (this.state.chainId.toString() === process.env.REACT_APP_NETID_ETH) {
        await schnoodleEth.methods.allowance(account, bridgeEthereum.options.address).call({ from: account }).then((result) => {
          if (result > 1000000000) {
            this.setState({ approvedEth: true });
          }
        });
      } else if (this.state.chainId.toString() === process.env.REACT_APP_NETID_BSC) {
        await schnoodleBsc.methods.allowance(account, bridgeBsc.options.address).call({ from: account }).then((result) => {
          if (result > 1000000000) {
            this.setState({ approvedBsc: true });
          }
        });
      }

      this.getErrorsFunc();
    }
  }

  async getEthFeeInfo() {
    const { web3Eth, ethApproveFee, ethSendFee, ethReceiveFee } = this.state;
    const [approveFee, sendFee, receiveFee] = await this.getFeeInfo(web3Eth, 'eth');
    this.setState({ ethApproveFee: approveFee ?? ethApproveFee, ethSendFee: sendFee ?? ethSendFee, ethReceiveFee: receiveFee ?? ethReceiveFee });
  }

  async getBnbFeeInfo() {
    const { web3Bsc, bscApproveFee, bscSendFee, bscReceiveFee } = this.state;
    const [approveFee, sendFee, receiveFee] = await this.getFeeInfo(web3Bsc, 'bsc');
    this.setState({ bscApproveFee: approveFee ?? bscApproveFee, bscSendFee: sendFee ?? bscSendFee, bscReceiveFee: receiveFee ?? bscReceiveFee });
  }

  async getFeeInfo(web3, symbol) {
    const { database } = this.state;

    const gas = await web3.eth.getGasPrice() / 1e18;
    let approveFee, sendFee, receiveFee;

    const approveFeeRef = ref(database, symbol + '/approveFee');
    onValue(approveFeeRef, (snapshot) => {
      const data = snapshot.val();
      approveFee = (data.approveFee * gas).toFixed(6);
    });

    const receiveFeeRef = ref(database, symbol + '/receiveFee');
    onValue(receiveFeeRef, (snapshot) => {
      const data = snapshot.val();
      receiveFee = (data.receiveFee * gas).toFixed(6);
    });

    const sendFeeRef = ref(database, symbol + '/sendFee');
    onValue(sendFeeRef, (snapshot) => {
      const data = snapshot.val();
      sendFee = (data.sendFee * gas).toFixed(6);
    });

    return [approveFee, sendFee, receiveFee];
  }

  getErrorsFunc = () => {
    if (this.isMetaMaskInstalled()) {
      this.resetErrorsFunc();
      if (this.state.firstNet === 'BEP') {
        if (this.state.chainId.toString() !== process.env.REACT_APP_NETID_BSC) {
          this.setState({ errorMessage: <div className="text-center text-red-500 mt-2.5">Wrong chain. Swap to {this.state.firstNet} network</div> });
        }
      } else if (this.state.firstNet === 'ERC') {
        if (this.state.chainId.toString() !== process.env.REACT_APP_NETID_ETH) {
          this.setState({ errorMessage: <div className="text-center text-red-500 mt-2.5">Wrong chain. Swap to {this.state.firstNet} network</div> });
        }
      }
    }
  }

  approveFunc = async () => {
    const { database, schnoodleEth, schnoodleBsc } = this.state;

    this.checkServerStatus();
    this.setState({ loadingApprove: true });
    var amountToken = (Math.pow(10, 18) * Math.pow(10, 18));
    var amount = `0x${amountToken.toString(16)}`;

    if (this.state.firstNet === 'ERC') {
      const approved = zzz(schnoodleEth, 'eth');
      this.setState({ approvedEth: approved });
    } else if (this.state.firstNet === 'BEP') {
      const approved = zzz(schnoodleBsc, 'bsc');
      this.setState({ approvedBsc: approved });
    }

    async function zzz(schnoodle, symbol) {
      let approved = false;
      await schnoodle.methods.approve(schnoodle.options.address, amount).send({ from: localStorage.getItem('account') })
        .on('receipt', function (receipt) {
          set(ref(database, symbol + '/'), {
            approveFee: receipt.gasUsed
          });
        })
        .on('transactionHash', async (hash) => {
          await this.waitForTxnMined(hash);
          this.setState({ loadingApprove: false });
          approved = true;
          this.checkServerStatus();
        }).catch(err => {
          if (err.code === 4001) {
            this.setState({ loadingApprove: false });
          }
        });

      return approved;
    }
  }

  async waitForTxnMined(hash) {
    let transactionReceipt = null;
    while (transactionReceipt === null) { // Waiting expectedBlockTime until the transaction is mined
      transactionReceipt = await this.state.web3.eth.getTransactionReceipt(hash);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  sendTokensFunc = async (amount) => {
    const { database, schnoodleEth, schnoodleBsc, bridgeEthereum, bridgeBsc } = this.state;

    const account = localStorage.getItem('account').split('');
    const accountToSend = account.slice(0, 6) + '...' + account.slice(-6);
    localStorage.setItem('accountToSend', accountToSend);
    this.setState({ accountToSend });
    localStorage.setItem('amountToSend', amount);
    this.setState({ amountToSend: amount });
    localStorage.setItem('typetrade', this.state.secondNet);

    if (this.state.firstNet === 'ERC') {
      www(schnoodleEth, bridgeEthereum, 'eth', 'ERC');
    } else if (this.state.firstNet === 'BEP') {
      www(schnoodleBsc, bridgeBsc, 'bsc', 'BEP');
    }

    async function www(schnoodle, bridge, symbol, tokenType) {
      this.setState({ loading: true });
      const decimals = await schnoodle.methods.decimals().call();
      const x = new BigNumber(amount);
      const y = new BigNumber(Math.pow(10, decimals));
      let amountSend = x.times(y);
      amountSend = amountSend.toString(10);

      await bridge.methods.sendTokens(amountSend).send({ from: localStorage.getItem('account') })
        .on('receipt', function (receipt) {
          set(ref(database, symbol + '/'), {
            sendFee: receipt.gasUsed
          });
        })
        .on('transactionHash', async (hash) => {
          await this.waitForTxnMined(hash);
          await this.apiRequestFunc(localStorage.getItem('account'), tokenType, this.state.secondNet);

          const urlArray = process.env.REACT_APP_SERVER_URLS.split(',');
          console.log(this.state.apiRequestAmount);

          if (this.state.apiRequestAmount !== urlArray.length) {
            localStorage.setItem('showReceive', false);
            this.setState({ serverError: 'Remote server error', apiRequestAmount: 0 });
          } else {
            this.setState({ apiRequestAmount: 0, loading: false });
            if (this.state.serverError === null) {
              this.setState({ showReceive: true });
              localStorage.setItem('showReceive', true);
            }
          }
        }).catch(err => {
          if (err.code === 4001) {
            localStorage.setItem('showReceive', false);
            this.setState({ loading: false });
          }
        });
    }
  }

  resetErrorsFunc = async () => {
    this.setState({ errorMessage: null });
  }

  apiRequestFunc = async (account, typeSwap, typeReceive) => {
    const urlArray = process.env.REACT_APP_SERVER_URLS.split(',');
    for (let i = 0; i < urlArray.length; i++) {
      await this.apiOneRequest(urlArray[i], account, typeSwap, typeReceive);
    }
  }

  apiOneRequest = async (server, account, typeSwap, typeReceive) => {
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

  changeChainId = async () => {
    const chainId = await this.state.web3.eth.net.getId();
    this.setState({ chainId: chainId });
  }

  receiveTokensFunc = async () => {
    this.checkServerStatus();

    if (this.state.secondNet === 'ERC') {
      xxx(this.state.bridgeEthereum, 'eth');
    } else if (this.state.secondNet === 'BEP') {
      xxx(this.state.bridgeBsc, 'bsc');
    }

    async function xxx(bridge, symbol) {
      this.setState({ loadingReceive: true });
      const { database, web3 } = this.state;

      this.changeChainId();
      const arrGas = this.state.gasPay;
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
          set(ref(database, symbol + '/'), {
            receiveFee: receipt.gasUsed + sum / gasPrice
          });
        })
        .on('transactionHash', async (hash) => {
          await this.waitForTxnMined(hash);
          this.setState({ hash: hash });
          this.setState({ loadingReceive: false });
          this.setState({ showReceive: false });
          this.setState({ showEnd: true });
          localStorage.setItem('showReceive', false);
          this.setState({ gasPay: [] });
        }).catch(err => {
          if (err.code === 4001) {
            this.setState({ loadingReceive: false });
            this.setState({ showReceive: true });
            localStorage.setItem('showReceive', true);
          }
        });
    }
  }

  checkTokenBalance = async (amount) => {
    if (this.isMetaMaskInstalled() && this.isMetaMaskConnected()) {
      if (!isNaN(+amount)) {
        if (this.state.chainId.toString() === process.env.REACT_APP_NETID_ETH) {
          yyy(schnoodleEth, schnoodleBsc, bridgeBsc);
        } else if (this.state.chainId.toString() === process.env.REACT_APP_NETID_BSC) {
          yyy(schnoodleBsc, schnoodleEth, bridgeEthereum);
        }

        async function yyy(schnoodle, schnoodleOther, bridgeOther)
        {
          const otherBridgeBalance = await schnoodleOther.methods.balanceOf(bridgeOther.options.address).call();

          const decimals = await schnoodle.methods.decimals().call();
          const currentBalance = await schnoodle.methods.balanceOf(localStorage.getItem('account')).call();

          if (parseFloat(amount) * Math.pow(10, decimals) > currentBalance) {
            this.setState({ errorMessageSend: <div className="text-center text-red-500 mt-2.5">Not enough tokens for transaction</div> });
          } else if (this.state.secondNet === 'BEP' && (parseFloat(amount) * Math.pow(10, decimals) > otherBridgeBalance)) {
            this.setState({ errorMessageSend: <div className="text-center text-red-500 mt-2.5">Not enough tokens on TODO bridge</div> });
          } else if (parseFloat(amount) < Math.pow(10, -decimals)) {
            this.setState({ errorMessageSend: <div className="text-center text-red-500 mt-2.5">Token amount below minimum</div> });
          } else {
            this.setState({ errorMessageSend: null });
          }
        }
      } else {
        this.setState({ errorMessageSend: <div className="text-center text-red-500 mt-2.5">Wrong input</div> });
      }
    }
  }

  endButton() {
    this.setState({ amount: null });
    this.resetErrorsFunc();
    this.firstNetReset();
    this.setState({ showEnd: false });
  }

  resetApprove() {
    this.setState({ approvedEth: false });
    this.setState({ approvedBsc: false });
    this.setState({ chainId: 0 });
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

  handleChange(e) {
    this.resetErrorsFunc();
    this.setState({ firstNet: e.value, typeSwap: '' });
    console.log(e.value);
  }

  handleChangeSecond(e) {
    const typeSwap = this.state.firstNet + 'to' + e.value;
    this.setState({ typeSwap: typeSwap, secondNet: e.value });
    console.log(typeSwap);
    if (this.isMetaMaskConnected()) {
      this.getErrorsFunc();
    }
  }

  firstNetReset() {
    this.setState({ firstNet: '' });
  }

  async handleChangeAmount(e) {
    const write = e.target.value;
    this.setState({ amount: write });
    this.checkTokenBalance(write);
  }

  async handleSubmit(e) {
    this.sendTokensFunc(this.state.amount);
  }

  render() {
    const options = [
      { value: 'BEP', label: 'BEP20' },
      { value: 'ERC', label: 'ERC20' }
    ];
    var options2 = [];
    if (this.state.firstNet === 'BEP') {
      options2 = [
        { value: 'ERC', label: 'ERC20' }
      ];
    } else if (this.state.firstNet === 'ERC') {
      options2 = [
        { value: 'BEP', label: 'BEP20' }
      ];
    }

    const styles = {
      valueContainer: () => ({
        width: 60
      }),
      singleValue: base => ({
        ...base,
        color: '#dc20bc'
      }),
      control: (base, state) => ({
        ...base,
        background: '#070c39',
        border: 'none'
      }),
      dropdownIndicator: base => ({
        ...base,
        color: '#dc20bc'
      }),
      menuList: base => ({
        ...base,
        background: '#070c39',
        color: '#dc20bc'
      }),
      option: (provided, state) => ({
        ...provided,
        color: state.isSelected || state.isFocused ? '#dc20bc' : '#6f1860',
        background: '#070c39'
      })
    }

    let bridge;
    if (this.state.loading) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <img src="/images/load.svg" alt="" className="w-16 h-16 mb-8 lg:mb-11 animate-spin" />
        <div className=" text-2xl lg:text-3xl leading-snug text-white text-center">Please wait while the token swap transaction is confirmed...
        </div>
      </div>;
    } else if (this.state.loadingApprove) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <img src="/images/load.svg" alt="" className="w-16 h-16 mb-8 lg:mb-11 animate-spin" />
        <div className=" text-2xl lg:text-3xl leading-snug text-white text-center">Please wait while the token approve is finished...
        </div>
      </div>;
    } else if (this.state.loadingReceive) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <img src="/images/load.svg" alt="" className="w-16 h-16 mb-8 lg:mb-11 animate-spin" />
        <div className=" text-2xl lg:text-3xl leading-snug text-white text-center">Please wait while the token recieve is finished...
        </div>
      </div>;
    } else if (this.state.showEnd) {
      bridge = <div className="col-span-7 lg:bg-main-bg bg-transparent lg:py-40 pt-10  lg:px-14 px-4 rounded-xl flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="flex items-center flex-col text-2xl lg:text-3xl ">
          <div className="text-center mb-9 leading-normal">We sent you <span className="text-main-color font-medium">{this.state.amountToSend}</span> <span className="font-bold">{`SNOOD ${this.state.secondNet === 'MATIC' ? 'MATIC' : (this.state.secondNet + '20')}`}</span> tokens to the address <span>
            <a className="text-main-color font-medium underline transition-all duration-200 hover:text-main-color-hover">{this.state.accountToSend}</a></span></div>
          <div className="text-lg mb-16 lg:mb-5 text-center">You can track the transaction: <a href={this.state.secondNet === 'BEP' ? `http://testnet.bscscan.com/tx/${this.state.hash}` : this.state.secondNet === 'MATIC' ? `http://polygonscan.com/tx/${this.state.hash}` : (`http://kovan.etherscan.io/tx/${this.state.hash}`)} target="_blank" rel="noreferrer"
            className="text-main-color transition-all duration-200 hover:text-main-color-hover hover:underline">link</a>
          </div>
          <button onClick={() => this.endButton()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
            END
          </button>
        </div>
      </div>;
    } else if (!this.state.serverStatus) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className=" text-2xl lg:text-3xl leading-snug text-white text-center">Service is now unavailable
        </div>
      </div>
    } else if (this.state.serverError != null) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className=" text-2xl lg:text-3xl leading-snug text-white text-center">{`Remote server error: ${this.state.serverError}`}
        </div>
      </div>;
    } else if (this.state.showReceive) {
      bridge = <div className="col-span-7 lg:bg-main-bg lg:py-40 pt-10  lg:px-14 px-4 rounded-xl bg-transparent flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
        <div className="text-center mb-14 leading-normal ">You will receive <span
          className="text-main-color font-medium">{this.state.amountToSend}</span> <span className="font-bold">{`SNOOD ${this.state.secondNet === 'MATIC' ? 'MATIC' : (this.state.secondNet + '20')}`}</span> tokens at <span>
            <div
              className="text-main-color hover:text-main-color-hover font-medium underline transition-all duration-200">{this.state.accountToSend}</div></span>
        </div>
        {this.state.secondNet === 'ERC' ? (this.state.chainId.toString() === process.env.REACT_APP_NETID_ETH ? <button onClick={() => this.receiveTokensFunc()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokensFunc} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>) : this.state.secondNet === 'BEP' ? (this.state.chainId.toString() === process.env.REACT_APP_NETID_BSC ? <button onClick={() => this.receiveTokensFunc()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokensFunc} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>) : (this.state.chainId.toString() === process.env.REACT_APP_NETID_MATIC ? <button onClick={() => this.receiveTokensFunc()} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">
          RECEIVE
        </button> : <button onClick={this.receiveTokensFunc} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">
          RECEIVE
        </button>)}
        {this.state.secondNet === 'ERC' ? (this.state.chainId.toString() === process.env.REACT_APP_NETID_ETH ? null : <div className="text-center text-sm mt-2.5">Swap to ETH network</div>) : this.state.secondNet === 'BEP' ? (this.state.chainId.toString() === process.env.REACT_APP_NETID_BSC ? null : <div className="text-center text-sm mt-2.5">Swap to BSC network</div>) : (this.state.chainId.toString() === process.env.REACT_APP_NETID_MATIC ? null : <div className="text-center text-sm mt-2.5">Swap to MATIC network</div>)}
      </div>
    } else {
      bridge =
        <div className="col-span-7 lg:px-6 lg:py-10 rounded-13 lg:bg-main-bg bg-transparent">
          <div className="flex items-center lg:mb-9 mb-6 flex-col lg:flex-row">
            <div className="w-full lg:w-5/12 p-5 lg:p-0 rounded-xl bg-second-bg lg:bg-transparent">
              <div className="font-bold text-xs lg:mb-4 text-main-color">From</div>
              <div className="flex items-center justify-between lg:p-4 bg-second-bg rounded-lg">
                <div className="">
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">
                    SNOOD
                  </div>
                  <Select styles={styles} options={options} onChange={this.handleChange} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="rounded-full w-16 h-16 flex justify-center items-center">
                  <img src="/images/logo-round.png" alt="" />
                </div>
              </div>
            </div>
            <button className="p-2 bg-main-color w-10 h-10 lg:mx-6 rounded-10 outline-none focus:outline-none -mt-3 lg:mt-7 relative z-20 lg:static transform rotate-90  lg:transform-none">
              <img className="block w-5 h-5 mx-auto" src="/images/arrows.svg" alt="" />
            </button>
            <div className="w-full lg:w-5/12 relative -top-3 lg:static bg-second-bg lg:bg-transparent p-5 lg:p-0 rounded-xl">
              <div className="font-bold text-xs lg:mb-4 text-main-color">To</div>
              <div className="flex items-center justify-between lg:p-5 bg-second-bg rounded-lg">
                <div className="">
                  <div className="text-second-text opacity-50 uppercase text-xl font-bold">
                    SNOOD
                  </div>
                  <Select styles={styles} options={options2} onChange={this.handleChangeSecond} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="w-16 h-16 flex justify-center items-center rounded-full">
                  <img src="/images/logo-round.png" alt="" />
                </div>
              </div>
            </div>
          </div>
          <div className="opacity-50 text-white md:text-base mb-4 tracking-wide text-xs">Details</div>
          <form id="form" onSubmit={this.handleSubmit}>
            <div className="flex flex-col border-solid mb-10 lg:mb-16">
              <input onChange={this.handleChangeAmount} className="w-full text-white bg-third-bg rounded-md text-sm border border-border p-3.5 font-medium outline-none focus:outline-none"
                placeholder="Amount" type="text" />
            </div>
            {this.state.typeSwap != '' && this.state.errorMessage === null && this.isMetaMaskInstalled() && this.isMetaMaskConnected() ? (this.state.firstNet === 'BEP' && this.state.approvedBsc === false) || (this.state.firstNet === 'ERC' && this.state.approved === false) || (this.state.firstNet === 'MATIC' && this.state.approvedmatic === false) ? <button onClick={this.approveFunc} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">Approve Token</button> : (this.state.errorMessageSend === null && this.state.amount != null && this.isMetaMaskConnected() ? <button from="form" type="submit" className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">Send Tokens</button> : <button from="form" type="submit" className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">Send Tokens</button>)
              : <button className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none button--disabled">Approve Token</button>}
          </form>{this.state.errorMessageSend}
          {this.state.errorMessage}
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
                <img className="w-40 h-auto" src="/images/logo.png" alt="" />
              </a>
              <ConnectWallet getApproveInfo={this.getApproveInfo} resetApprove={this.resetApprove} changeChainId={this.changeChainId} getErrorsFunc={this.getErrorsFunc} resetErrorsFunc={this.resetErrorsFunc} />
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
                  <div className="ml-1.5 text-white">{this.state.firstNet === 'ERC' ? (`~ ${this.state.ethApproveFee.toString()} ETH`) : (`~ ${this.state.bscApproveFee.toString()} BNB`)}</div>
                </div>
                <div className="flex text-main-text mb-1.5">
                  Send:
                  <div className="ml-1.5 text-white">{this.state.firstNet === 'ERC' ? (`~ ${this.state.ethSendFee.toString()} ETH`) : (`~ ${this.state.bscSendFee.toString()} BNB`)}</div>
                </div>
                <div className="flex text-main-text mb-7">
                  Receive:
                  <div className="ml-1.5 text-white">{this.state.secondNet === 'BEP' ? (`~ ${this.state.bscReceiveFee.toString()} BNB`) : (`~ ${this.state.ethReceiveFee.toString()} ETH`)}</div>
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
