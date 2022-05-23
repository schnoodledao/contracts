// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { bridge as resources } from '../resources';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import getWeb3 from '../getWeb3';
import { initializeHelpers, handleError, scaleUpUnits, scaleDownUnits, scaleDownPrecise, createEnum } from '../helpers';

// Third-party libraries
import Web3 from 'web3';
import Select from 'react-select';

const Network = createEnum(['ethereum', 'bsc']);
// ReSharper restore InconsistentNaming

// global fetch: false

const networks =
{
  ethereum: {
    name: 'Ethereum',
    id: Number(process.env.REACT_APP_ETH_NET_ID),
    url: process.env.REACT_APP_ETH_URL,
    standard: 'ERC20',
    symbol: 'ETH',
    rpcUrls: ['https://mainnet.infura.io/v3/']
  },
  bsc: {
    name: 'BNB Smart Chain',
    id: Number(process.env.REACT_APP_BSC_NET_ID),
    url: process.env.REACT_APP_BSC_URL,
    standard: 'BEP20',
    symbol: 'BNB',
    rpcUrls: ['https://bsc-dataseed.binance.org/']
  }
};

export default class Bridge extends Component {
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
    this.swapNetworks = this.swapNetworks.bind(this);
    this.changeSourceNetwork = this.changeSourceNetwork.bind(this);
    this.changeTargetNetwork = this.changeTargetNetwork.bind(this);
    this.updateAmount = this.updateAmount.bind(this);
    this.close = this.close.bind(this);
  }

  async componentDidMount() {
    try {
      // Web3
      const web3Eth = new Web3(networks[Network.ethereum].url);
      const web3Bsc = new Web3(new Web3.providers.HttpProvider(networks[Network.bsc].url));

      // Smart contracts
      const schnoodleEthNetwork = SchnoodleV1.networks[networks[Network.ethereum].id];
      const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = SchnoodleV1.networks[networks[Network.bsc].id];
      const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);

      window.ethereum.on('networkChanged', async () => await this.updateWeb3());

      this.setState({
        web3Eth,
        web3Bsc,
        schnoodleEthNetwork,
        schnoodleEth,
        schnoodleBscNetwork,
        schnoodleBsc
      }, async () => {
        await this.updateWeb3();
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

  async updateWeb3(callback) {
    const web3 = await getWeb3();
    const { schnoodleEthNetwork, schnoodleBscNetwork } = this.state;

    let schnoodle, sourceNetwork;
    const networkId = await web3.eth.net.getId();
    const selectedAddress = web3.currentProvider.selectedAddress;

    switch (networkId.toString()) {
      case process.env.REACT_APP_ETH_NET_ID:
        schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
        sourceNetwork = Network.ethereum;
        break;
      case process.env.REACT_APP_BSC_NET_ID:
        schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
        sourceNetwork = Network.bsc;
        break;
      default:
        throw new Error(`Network ID ${networkId} unsupported.`);
    }

    await initializeHelpers(await schnoodle.methods.decimals().call());

    await this.changeTargetNetwork({ value: localStorage.getItem('targetNetwork') ?? sourceNetwork });
    await this.changeSourceNetwork({ value: localStorage.getItem('sourceNetwork') ?? sourceNetwork });

    this.setState({
      web3,
      networkId,
      schnoodle,
      selectedAddress
    }, callback);
  }

  async getInfo() {
    let serverStatus = false;
    try {
      serverStatus = (await fetch(`${process.env.REACT_APP_SERVER_URL}/Alive`)).ok;

      if (serverStatus) {
        const { selectedAddress, sourceNetwork, targetNetwork } = this.state;

        if (selectedAddress && sourceNetwork && targetNetwork) {
          const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetTokensPending`, {
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
    const switchNetwork = async (network, callback) => {
      try {
        // Attempt to switch the user's wallet to the target network so they can receive their tokens
        if (Number(window.ethereum.networkVersion) !== network.id) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: this.state.web3.utils.toHex(network.id) }]
          });

          await this.updateWeb3(callback);
        } else {
          await callback();
        }
      } catch (err) {
        // This error code indicates that the chain has not been added to the wallet
        if (err.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainName: network.name,
                chainId: this.state.web3.utils.toHex(network.id),
                nativeCurrency: {
                  name: network.symbol,
                  symbol: network.symbol,
                  decimals: 18
                },
                rpcUrls: network.rpcUrls
              }
            ]
          });
        } else {
          throw err;
        }
      }
    }

    try {
      this.setState({ busySwap: true });

      // Ensure the user's wallet is set to the source network so they can send their tokens
      await switchNetwork(networks[this.state.sourceNetwork], async () => {
        try {
          const { amount, schnoodle, selectedAddress, targetNetwork } = this.state;
          const targetNetworkInfo = networks[targetNetwork];

          this.handleReceipt(await schnoodle.methods.sendTokens(targetNetworkInfo.id, scaleUpUnits(amount).toString()).send({ from: selectedAddress }));

          // Attempt to switch the user's wallet to the target network so they can receive their tokens
          await switchNetwork(targetNetworkInfo);
        } catch (err1) {
          this.handleError(err1);
          this.setState({ busySwap: false });
        }

        this.setState({ busySwap: false });
      });
    } catch (err2) {
      this.handleError(err2);
      this.setState({ busySwap: false });
    }
  }

  async receiveTokens() {
    try {
      const { schnoodle, selectedAddress, sourceNetwork, targetNetwork } = this.state;
      this.setState({ busyReceive: true });

      // Pay the fee (suggested by the server) to the Schnoodle contract
      const sourceNetworkId = networks[sourceNetwork].id;
      const fee = await this.getFee(targetNetwork) - await schnoodle.methods.feesPaid(selectedAddress, sourceNetworkId).call();
      if (fee) this.handleReceipt(await schnoodle.methods.payFee(sourceNetworkId).send({ from: selectedAddress, value: fee }));

      // Request the server to call receiveTokens on the Schnoodle contract
      const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/ReceiveTokens`, {
        method: 'POST',
        body: JSON.stringify({ address: selectedAddress, sourceNetwork, targetNetwork })
      })).json();

      if (json.status !== 'ok') {
        this.setState({ serverError: json.body.message });
      } else {
        await this.getInfo();
      }
    } catch (err) {
      this.handleError(err);
    }

    this.setState({ busyReceive: false });
  }

  async swapNetworks() {
    const { sourceNetwork, targetNetwork } = this.state;
    await this.changeSourceNetwork({ value: targetNetwork });
    await this.changeTargetNetwork({ value: sourceNetwork });
  }

  async changeSourceNetwork(e) {
    await this.changeNetwork(e.value, this.state.targetNetwork, 'sourceNetwork', 'targetNetwork');
  }

  async changeTargetNetwork(e) {
    await this.changeNetwork(e.value, this.state.sourceNetwork, 'targetNetwork', 'sourceNetwork');
  }

  async changeNetwork(network, counterNetwork, networkKey, counterNetworkKey) {
    localStorage.setItem(networkKey, network);
    if (network === counterNetwork) {
      await this.changeNetwork(Object.keys(networks).find(key => key !== counterNetwork), network, counterNetworkKey, networkKey);
    }

    this.setState({ [networkKey]: network }, async () => await this.getInfo());
  }

  async getFee(network) {
    // Get the fee that must be paid before receiving tokens on the blockchain
    const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetFee`, {
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
    const targetNetworks = sourceNetworks;

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

    const displayAccount = selectedAddress ? selectedAddress.slice(0, 6) + '...' + selectedAddress.slice(-6) : '';

    let bridge;
    if (busyMessage) {
      bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-color tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
        <img src="/assets/img/svg/load.svg" alt="" className="tw-w-16 tw-h-16 tw-mb-8 lg:tw-mb-11 tw-animate-spin" />
        <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{busyMessage}</div>
      </div>;
    } else if (showClose) {
      bridge = <div className="tw-col-span-7 lg:tw-bg-violet-900 bg-transparent lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl tw-text-white">
        <div className="tw-flex tw-items-center tw-flex-col tw-text-2xl lg:tw-text-3xl">
          <div className="tw-text-center tw-mb-9 tw-leading-normal">We sent you <span className="text-main-color tw-font-medium">{tokensPending}</span> <span className="tw-font-bold">{`SNOOD to the ${targetNetwork} network at address ${displayAccount}`}</span></div>
          <div className="tw-text-lg tw-mb-16 lg:tw-mb-5 tw-text-center">You can track the transaction <a href={sourceNetwork === Network.bsc ? `http://testnet.bscscan.com/tx/${hash}` : (`http://rinkeby.etherscan.io/tx/${hash}`)} target="_blank" rel="noreferrer" className="text-main-color tw-transition-all tw-duration-200 hover:text-main-color hover:tw-underline">here</a></div>
          <button onClick={this.close} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-color tw-text-white tw-outline-none focus:tw-outline-none">CLOSE</button>
        </div>
      </div>;
    } else if (!serverStatus) {
      bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
        <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">Waiting for server...</div>
      </div>;
    } else if (serverError != null) {
      bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
        <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{`Remote server error: ${serverError}`}</div>
      </div>;
    } else {
      bridge =
        <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-13 lg:bg-violet-900 tw-bg-transparent">
          <div className="tw-flex tw-items-center lg:tw-mb-9 tw-mb-6 tw-flex-col lg:tw-flex-row">
            <div className="tw-w-full lg:tw-w-5/12 tw-p-12 tw-rounded-xl tw-bg-neutral lg:tw-bg-transparent">
              <div className="tw-font-bold tw-text-xs lg:tw-mb-4 text-main-color">From</div>
              <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                <div>
                  <div className="tw-text-gray-400 tw-opacity-50 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                  <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(network => network.value === sourceNetwork)} onChange={this.changeSourceNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="tw-rounded-full tw-w-1/6 lg:tw-w-3/6 tw-h-1/6 tw-flex tw-justify-center tw-items-center"><img src="/assets/img/png/logo-krypto.png" alt="" /></div>
              </div>
            </div>
            <button onClick={this.swapNetworks} className="tw-p-2 bg-color tw-w-10 tw-h-10 lg:tw-mx-6 tw-content-center tw-rounded-lg outline-none focus:outline-none tw--my-4 lg:tw-mt-7 tw-relative tw-z-20 lg:tw-static tw-transform tw-rotate-90 lg:tw-transform-none">
              <img className="tw-block tw-w-5 tw-h-5 tw-mx-auto" src="/assets/img/svg/arrows.svg" alt="" />
            </button>
            <div className="tw-w-full lg:tw-w-5/12 tw-relative -mt-3 lg:tw-static tw-bg-neutral lg:tw-bg-transparent tw-p-12 tw-rounded-xl">
              <div className="tw-font-bold tw-text-xs lg:tw-mb-4 text-main-color">To</div>
              <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                <div>
                  <div className="tw-text-gray-400 tw-opacity-50 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                  <Select styles={styles} options={targetNetworks} value={targetNetworks.find(network => network.value === targetNetwork)} onChange={this.changeTargetNetwork} components={{ IndicatorSeparator: () => null }} />
                </div>
                <div className="tw-w-1/6 lg:tw-w-3/6 tw-h-1/6 tw-flex tw-justify-center tw-items-center tw-rounded-full"><img src="/assets/img/png/logo-krypto.png" alt="" /></div>
              </div>
            </div>
          </div>
          {tokensPending > 0
            ? <div className="tw-col-span-7 lg:bg-color lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl">
              <div className="tw-text-center tw-mb-14 tw-leading-normal">
                <span className="text-main-color tw-font-medium">{scaleDownUnits(tokensPending)}</span> <span className="tw-font-bold">{'SNOOD ready to be received'}</span>
              </div>
              <button onClick={this.receiveTokens} disabled={networkId !== networks[targetNetwork].id} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-main-color-hover tw-text-white tw-outline-none focus:tw-outline-none">RECEIVE</button>
            </div>
            : <div>
              <div className="tw-flex tw-flex-col tw-border-solid tw-mb-10 lg:tw-mb-16">
                <input type="number" min="1" placeholder="Amount" value={amount || ''} onChange={this.updateAmount} className="tw-w-full tw-text-white tw-bg-neutral tw-rounded-md tw-text-sm tw-border tw-border-border tw-p-3.5 tw-font-medium tw-outline-none focus:tw-outline-none" />
              </div>
              <button onClick={this.sendTokens} disabled={amount === 0} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-main-color-hover tw-text-white tw-outline-none focus:tw-outline-none">SEND</button>
            </div>
          }
          <div className="tw-text-center tw-mt-2.5">
            <p style={{ color: this.state.success ? 'green' : 'red' }}>{message}</p>
          </div>
        </div>;
    }

    return (
      <div className="tw-font-Roboto tw-flex tw-flex-col tw-min-h-screen tw-bg-violet-900">
        <div className="lg:tw-py-16 tw-py-10 tw-flex-grow">
          <div className="tw-mx-auto tw-w-full lg:tw-max-w-5xl tw-px-4">
            <div className="lg:tw-grid lg:tw-grid-cols-12 tw-block">
              <div className="tw-col-span-5 tw-rounded-13 lg:tw-px-8 lg:tw-mr-8 lg:tw-py-10 lg:tw-bg-violet-900 tw-bg-transparent tw-relative">
                {fee &&
                  <div>
                    <div className="tw-flex text-main-text tw-mb-7">
                      Receive Fee:
                      <div className="tw-ml-1.5 tw-text-white">{`${scaleDownPrecise(fee, 6)} ${networks[targetNetwork].symbol}`}</div>
                    </div>
                  </div>
                }
              </div>
              {bridge}
            </div>
          </div>
        </div>

        <footer className="tw-hidden lg:tw-block tw-bg-violet-900 tw-h-9" />
      </div>
    );
  }
}
