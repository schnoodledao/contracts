// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { bridge as resources } from '../resources';
import './Bridge.css'
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import getWeb3 from '../getWeb3';
import { initializeHelpers, scaleUpUnits, scaleDownUnits, scaleDownPrecise, handleError, createEnum } from '../helpers';

// Third-party libraries
import Web3 from 'web3';
import Select from 'react-select';
// ReSharper restore InconsistentNaming

// global fetch: false

const network = createEnum(['ethereum', 'bsc']);

const networks =
{
  ethereum: {
    id: Number(process.env.REACT_APP_ETH_NET_ID),
    url: process.env.REACT_APP_ETH_URL,
    standard: 'ERC20',
    token: 'ETH'
  },
  bsc: {
    id: Number(process.env.REACT_APP_BSC_NET_ID),
    url: process.env.REACT_APP_BSC_URL,
    standard: 'BEP20',
    token: 'BNB'
  }
};

export class Bridge extends Component {
  static displayName = Bridge.name;

  constructor(props) {
    super(props);

    this.state = {
      success: false,
      busyApprove: false,
      busySwap: false,
      busyReceive: false,
      tokensPending: 0,
      amount: 0,
      serverError: null,
      showClose: false
    }

    this.handleError = handleError.bind(this);
    this.sendTokens = this.sendTokens.bind(this);
    this.receiveTokens = this.receiveTokens.bind(this);
    this.changeSourceNetwork = this.changeSourceNetwork.bind(this);
    this.changeTargetNetwork = this.changeTargetNetwork.bind(this);
    this.updateAmount = this.updateAmount.bind(this);
    this.close = this.close.bind(this);
  }

  async componentDidMount() {
    try {
      // Web3
      const web3 = await getWeb3();
      const web3Eth = new Web3(networks[network.ethereum].url);
      const web3Bsc = new Web3(new Web3.providers.HttpProvider(networks[network.bsc].url));

      // Smart contracts
      const schnoodleEthNetwork = SchnoodleV1.networks[networks[network.ethereum].id];
      const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = SchnoodleV1.networks[networks[network.bsc].id];
      const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
      const selectedAddress = web3.currentProvider.selectedAddress;

      let schnoodle, sourceNetwork;
      const networkId = await web3.eth.net.getId();

      switch (networkId.toString()) {
        case process.env.REACT_APP_ETH_NET_ID:
          schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
          sourceNetwork = network.ethereum;
          break;
        case process.env.REACT_APP_BSC_NET_ID:
          schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
          sourceNetwork = network.bsc;
          break;
        default:
          throw new Error(`Network ID ${networkId} unsupported.`);
      }

      await initializeHelpers(await schnoodle.methods.decimals().call());

      this.setState({
        web3,
        networkId,
        web3Eth,
        web3Bsc,
        schnoodle,
        sourceNetwork: localStorage.getItem('sourceNetwork') ?? sourceNetwork,
        targetNetwork: localStorage.getItem('targetNetwork'),
        schnoodleEthNetwork,
        schnoodleEth,
        schnoodleBscNetwork,
        schnoodleBsc,
        selectedAddress
      }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 10000);
        this.setState({ getInfoIntervalId });
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.getInfoIntervalId);
  }

  async getInfo() {
    let serverStatus = false;
    try {
      serverStatus = (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/Alive`)).ok;

      if (serverStatus) {
        const { selectedAddress, sourceNetwork, targetNetwork } = this.state;

        if (selectedAddress && sourceNetwork && targetNetwork) {
          const json = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/GetTokensPending`, {
            method: 'POST',
            body: JSON.stringify({ address: selectedAddress, sourceNetwork, targetNetwork })
          })).json();

          if (json.status === 'ok') {
            this.setState({ tokensPending: json.body.tokensPending });
          } else {
            this.setState({ serverError: json.body.err.message });
          }
        }

        this.setState({ fee: await this.getFee(targetNetwork) });
      }
    } catch (err) {
      this.handleError(err, false);
    }

    this.setState({ serverStatus });
  }

  //#region Handling

  handleReceipt(receipt) {
    if (receipt.status) {
      this.setState({ success: true, message: receipt.transactionHash });
    } else {
      throw new Error(receipt);
    }
  }
  
  //#endregion

  async sendTokens() {
    try {
      const { amount, schnoodle, selectedAddress, targetNetwork } = this.state;
      this.setState({ busySwap: true });
      this.handleReceipt(await schnoodle.methods.sendTokens(networks[targetNetwork].id, scaleUpUnits(amount).toString()).send({ from: selectedAddress }));
    } catch (err) {
      this.handleError(err);
    }

    this.setState({ busySwap: false });
  }

  async receiveTokens() {
    try {
      const { schnoodle, selectedAddress, sourceNetwork, targetNetwork } = this.state;
      this.setState({ busyReceive: true });

      // Pay the fee (suggested by the server) to the Schnoodle contract
      this.handleReceipt(await schnoodle.methods.payFee(networks[sourceNetwork].id).send({ from: selectedAddress, value: await this.getFee(targetNetwork) }));

      // Request the server to call receiveTokens on the Schnoodle contract
      const jsonTokens = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/ReceiveTokens`, {
        method: 'POST',
        body: JSON.stringify({ address: selectedAddress, sourceNetwork, targetNetwork })
      })).json();

      if (jsonTokens.status !== 'ok') {
        this.setState({ serverError: jsonTokens.body.message });
      }
    } catch (err) {
      this.handleError(err);
    }

    this.setState({ busyReceive: false });
  }

  async changeSourceNetwork(e) {
    const sourceNetwork = e.value;
    localStorage.setItem('sourceNetwork', sourceNetwork);
    this.setState({ sourceNetwork }, async () => await this.getInfo());
  }

  async changeTargetNetwork(e) {
    try {
      const targetNetwork = e.value;
      localStorage.setItem('targetNetwork', targetNetwork);
      this.setState({ targetNetwork }, async () => await this.getInfo());
    } catch (err) {
      this.handleError(err);
    }
  }

  async getFee(network) {
    // Get the fee that must be paid before receiving tokens on the blockchain
    const json = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/GetFee`, {
      method: 'POST',
      body: JSON.stringify({ network })
    })).json();

    if (json.status === 'ok') {
      return json.body.fee;
    } else {
      throw new Error(json.body.err.message);
    }
  }

  async updateAmount(e) {
    const amount = Number(e.target.value);
    if (!Number.isInteger(amount)) return;
    this.setState({ amount });
  }

  handleFaq() {
    localStorage.setItem('info', 'faq');
  }

  handleGuide() {
    localStorage.setItem('info', 'guide');
  }

  close() {
    this.clearMessage();
    this.setState({ showClose: false, amount: 0, tokensReceived: 0 });
  }

  clearMessage() {
    this.setState({ message: null });
  }

  render() {
    const { networkId, sourceNetwork, targetNetwork, busyApprove, busySwap, busyReceive, showClose, tokensPending, fee, amount, selectedAddress, serverStatus, serverError, hash, message } = this.state;

    const sourceNetworks = Object.keys(networks).map((key) => { return { value: key, label: networks[key].standard } });
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

    //const displayFee = (fee, symbol) => `~ ${((fee ?? 0) * gasPrice).toFixed(6).toString()} ${symbol}`;
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
          <div className="text-center mb-9 leading-normal">We sent you <span className="text-main-color font-medium">{tokensPending}</span> <span className="font-bold">{`SNOOD to the ${targetNetwork} network`}</span> at address <span><a className="text-main-color font-medium underline transition-all duration-200 hover:text-main-color-hover">{displayAccount}</a></span></div>
          <div className="text-lg mb-16 lg:mb-5 text-center">You can track the transaction <a href={sourceNetwork === network.bsc ? `http://testnet.bscscan.com/tx/${hash}` : (`http://rinkeby.etherscan.io/tx/${hash}`)} target="_blank" rel="noreferrer" className="text-main-color transition-all duration-200 hover:text-main-color-hover hover:underline">here</a></div>
          <button onClick={this.close} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">CLOSE</button>
        </div>
      </div>;
    } else if (!serverStatus) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">Server offline</div>
      </div>;
    } else if (serverError != null) {
      bridge = <div className="col-span-7 lg:px-6 lg:bg-tutu lg:py-10 rounded-xl lg:bg-main-bg bg-transparent flex items-center flex-col justify-center mt-14 lg:mt-0">
        <div className="text-2xl lg:text-3xl leading-snug text-white text-center">{`Remote server error: ${serverError}`}</div>
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
          {tokensPending > 0 && networkId === networks[targetNetwork].id
            ? <div className="col-span-7 lg:bg-main-bg lg:py-40 pt-10 lg:px-14 px-4 rounded-xl bg-transparent flex items-center flex-col justify-center text-2xl lg:text-3xl text-white">
                <div className="text-center mb-14 leading-normal">
                  <span className="text-main-color font-medium">{scaleDownUnits(tokensPending)}</span> <span className="font-bold">{'SNOOD ready to be received'}</span>
                </div>
                <button onClick={this.receiveTokens} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">RECEIVE</button>
              </div>
            : <div>
                <div className="flex flex-col border-solid mb-10 lg:mb-16">
                  <input type="number" min="1" placeholder="Amount" value={amount || ''} onChange={this.updateAmount} className="w-full text-white bg-third-bg rounded-md text-sm border border-border p-3.5 font-medium outline-none focus:outline-none" />
                </div>
                <button onClick={this.sendTokens} disabled={targetNetwork == null || message != null || amount === 0} className="text-sm max-w-xs w-full mx-auto h-12 bg-main-color block rounded transition-all duration-200 hover:bg-main-color-hover text-white outline-none focus:outline-none">SEND</button>
              </div>
          }
          <div className="text-center mt-2.5">
            <p style={{ color: this.state.success ? 'green' : 'red' }}>{message}</p>
          </div>
        </div>;
    }

    return (
      <div className="font-Roboto flex flex-col min-h-screen bg-body">
        <div className="lg:py-16 py-10 flex-grow">
          <div className="container">
            <div className="lg:grid grid-cols-12 block">
              <div className="col-span-5 rounded-13 lg:px-8 lg:mr-8 lg:py-10 lg:bg-main-bg bg-transparent relative">
                <div className="text-3xl lg:mb-8 mb-4 text-gradient bg-gradient-to-r from-purple-from to-purple-to">Schnoodle Bridge</div>
                <div className="lg:mb-8 mb-4 text-white">The bridge allows to exchange ERC20 tokens for BEP20 tokens as well as BEP20 for ERC20</div>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl transition-all duration-200 hover:text-main-color-hover" href="/info" onClick={() => this.handleGuide()}>Token exchange guide</a>
                <a className="font-bold text-main-color lg:block mb-8 hidden text-xl transition-all duration-200 hover:text-main-color-hover" href="/info" onClick={() => this.handleFAQ()}>FAQ</a>
                {fee &&
                  <div>
                    <div className="flex font-bold text-second-color lg:mb-8 mb-2 text-xl items-center">Fees</div>
                    <div className="flex text-main-text mb-7">
                      Receive:
                      <div className="ml-1.5 text-white">{`${scaleDownPrecise(fee, 6)} ${networks[targetNetwork].token}`}</div>
                    </div>
                  </div>
                }
              </div>
              {bridge}
            </div>
          </div>
        </div>

        <footer className="hidden lg:block bg-main-bg h-9" />

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
