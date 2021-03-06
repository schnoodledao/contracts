// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { general, bridge as resources } from '../resources';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import { initializeHelpers, handleError, getWeb3, scaleUpUnits, scaleDownUnits, scaleDownPrecise, createEnum } from '../helpers';

// Third-party libraries
import Web3 from 'web3';
import Select, { components } from 'react-select';
import { Puff } from 'react-loader-spinner';
const bigInt = require('big-integer');

const Network = createEnum(['ethereum', 'bsc']);
// ReSharper restore InconsistentNaming

// global fetch: false

const networks =
{
  ethereum: {
    name: process.env.REACT_APP_ETH_NET_NAME,
    id: Number(process.env.REACT_APP_ETH_NET_ID),
    url: process.env.REACT_APP_ETH_URL,
    display: 'Ethereum',
    symbol: 'ETH',
    rpcUrls: [process.env.REACT_APP_ETH_RPC_URL],
    explorerUrls: [process.env.REACT_APP_ETH_EXPLORER_URL]
  },
  bsc: {
    name: process.env.REACT_APP_BSC_NET_NAME,
    id: Number(process.env.REACT_APP_BSC_NET_ID),
    url: process.env.REACT_APP_BSC_URL,
    display: 'BSC',
    symbol: 'BNB',
    rpcUrls: [process.env.REACT_APP_BSC_RPC_URL],
    explorerUrls: [process.env.REACT_APP_BSC_EXPLORER_URL]
  }
};

export default class Bridge extends Component {
  static displayName = Bridge.name;

  constructor(props) {
    super(props);

    this.state = {
      success: false,
      busySwap: false,
      busyReceive: false,
      tokensPending: 0,
      amount: 0,
      serverError: null
    }

    this.handleError = handleError.bind(this);
    this.sendTokens = this.sendTokens.bind(this);
    this.receiveTokens = this.receiveTokens.bind(this);
    this.swapNetworks = this.swapNetworks.bind(this);
    this.changeSourceNetwork = this.changeSourceNetwork.bind(this);
    this.changeTargetNetwork = this.changeTargetNetwork.bind(this);
    this.updateAmount = this.updateAmount.bind(this);
  }

  async componentDidMount() {
    try {
      // Web3
      const web3 = await getWeb3();
      const web3Eth = new Web3(networks[Network.ethereum].url);
      const web3Bsc = new Web3(new Web3.providers.HttpProvider(networks[Network.bsc].url));
      const networkId = await web3.eth.net.getId();
      const selectedAddress = web3.currentProvider.selectedAddress;

      // Smart contracts
      const schnoodleEthNetwork = SchnoodleV1.networks[networks[Network.ethereum].id];
      const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = SchnoodleV1.networks[networks[Network.bsc].id];
      const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);

      let schnoodle, sourceNetwork;

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

      window.ethereum.on('networkChanged', () => window.location.reload(true));

      this.setState({
        web3,
        web3Eth,
        web3Bsc,
        schnoodleEthNetwork,
        schnoodleEth,
        schnoodleBscNetwork,
        schnoodleBsc,
        networkId,
        schnoodle,
        selectedAddress,
        message: null
      }, async () => {
        await this.changeTargetNetwork({ value: localStorage.getItem('targetNetwork') ?? sourceNetwork });
        await this.changeSourceNetwork({ value: localStorage.getItem('sourceNetwork') ?? sourceNetwork });
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
            this.setState({ serverError: json.body.message });
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

  async switchNetwork(network, callback) {
    try {
      // Attempt to switch the user's wallet to the target network so they can receive their tokens
      if (Number(window.ethereum.networkVersion) !== network.id) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: this.state.web3.utils.toHex(network.id) }]
        });
      } else {
        await callback();
      }
    } catch (err) {
      // This error code indicates that the chain has not been added to the wallet
      if (err.code === 4902 || err.data?.originalError?.code === 4902) {
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
              rpcUrls: network.rpcUrls,
              blockExplorerUrls: network.explorerUrls
            }
          ]
        });
      } else {
        throw err;
      }
    }
  }

  async sendTokens() {
    try {
      this.setState({ busySwap: true });

      // Ensure the user's wallet is set to the source network so they can send their tokens
      await this.switchNetwork(networks[this.state.sourceNetwork], async () => {
        const { amount, schnoodle, selectedAddress, targetNetwork } = this.state;
        const targetNetworkInfo = networks[targetNetwork];

        this.handleReceipt(await schnoodle.methods.sendTokens(targetNetworkInfo.id, scaleUpUnits(amount).toString()).send({ from: selectedAddress }));

        // Attempt to switch the user's wallet to the target network so they can receive their tokens
        await this.switchNetwork(targetNetworkInfo);
      });
    } catch (err) {
      this.handleError(err);
    }

    this.setState({ busySwap: false });
  }

  async receiveTokens() {
    try {
      this.setState({ busyReceive: true });

      // Ensure the user's wallet is set to the target network so they can receive their tokens
      await this.switchNetwork(networks[this.state.targetNetwork], async () => {
        const { schnoodle, selectedAddress, sourceNetwork, targetNetwork } = this.state;

        // Pay the fee (suggested by the server) to the Schnoodle contract
        const sourceNetworkId = networks[sourceNetwork].id;
        const fee = await this.getFee(targetNetwork) - await schnoodle.methods.feesPaid(selectedAddress, sourceNetworkId).call();
        if (fee > 0) this.handleReceipt(await schnoodle.methods.payFee(sourceNetworkId).send({ from: selectedAddress, value: fee }));

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
      });
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

    const { sourceNetwork, schnoodleEth, schnoodleBsc, selectedAddress } = this.state;
    let schnoodleSource;

    switch (sourceNetwork) {
      case Network.ethereum:
        schnoodleSource = schnoodleEth;
        break;
      case Network.bsc:
        schnoodleSource = schnoodleBsc;
        break;
      default:
        throw new Error(`Source network ${sourceNetwork} unsupported.`);
    }

    this.setState({ availableAmount: bigInt(await schnoodleSource.methods.unlockedBalanceOf(selectedAddress).call()) }, async () =>
    {
      await this.setAmount(localStorage.getItem(`${sourceNetwork}Amount`));
    });
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
      throw new Error(json.body.message);
    }
  }

  async updateAmount(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setAmount(value);
  }

  async setAmount(amount) {
    this.setState({ amount: Math.min(Math.floor(amount), scaleDownUnits(this.state.availableAmount)) }, () => {
      localStorage.setItem(`${this.state.sourceNetwork}Amount`, this.state.amount);
    });
  }

  render() {
    const { networkId, sourceNetwork, targetNetwork, selectedAddress, busySwap, busyReceive, tokensPending, fee, amount, serverStatus, serverError, message } = this.state;

    const availableAmount = scaleDownUnits(this.state.availableAmount);
    const sourceNetworks = Object.keys(networks).map((key) => { return { value: key, label: networks[key].display } });
    const targetNetworks = sourceNetworks;

    const styles = {
      valueContainer: () => ({ width: 120, border: 'none', display: 'grid' }),
      singleValue: base => ({ ...base, color: 'white', }),
      control: (base, state) => ({ ...base, background: '#070c39', borderRadius: '0.5em', borderWidth: '0px', boxShadow: '0px 12px 7px rgba(0, 0, 0, 0.34)' }),
      dropdownIndicator: (base, state) => ({ ...base, color: 'white' }),
      menuList: base => ({ ...base, background: '#070c39', color: 'white' }),
      option: (provided, state) => ({ ...provided, color: state.isSelected || state.isFocused ? '#dc20bc' : 'white', background: '#070c39' })
    }

    const { Option, SingleValue } = components;  

    const option = props => (
      <div className="tw-flex">
        <img
          src={`/assets/img/svg/${props.data.value}.svg`}
          className="tw-w-1/6 tw-mx-1 plustop"
          alt={props.data.label}
        />
        <span className="plustop">{props.data.label}</span>
      </div>
    );

    const singleValue = props => (
      <SingleValue {...props}>
        {option(props)}
      </SingleValue>
    );

    const singleOption = props => (
      <Option {...props}>
        {option(props)}
      </Option>
    );

    const busyMessage = busySwap
      ? resources.BUSY_MESSAGE_SWAP
      : busyReceive
        ? resources.BUSY_MESSAGE_RECEIVE
        : null;

    let bridge;

    if (!this.state.web3 || !serverStatus) {
      return (
        <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
          <div className="h-noheader md:tw-flex">
            <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
              <div className="tw-px-4">
                <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
                <div className="maintitles tw-uppercase">{resources.BRIDGE}</div>
                <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
                <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{general.LOADING}<span>.</span><span>.</span><span>.</span></p>
                <div className="tw-px-4 tw-mt-4 fakebtn">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (busyMessage) {
      bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-color tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
        <Puff color="#00BFFF" />
        <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{busyMessage}</div>
      </div>;
    } else if (serverError != null) {
      bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
        <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{`Server error: ${serverError}`}</div>
      </div>;
    } else {
      const token = 'SNOOD';
      bridge =
      <div className="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
        <div className="tw-col-span-7 tw-p-9 lg:tw-px-6 tw-rounded-13 lg:bg-violet-900 tw-bg-transparent">
          <div className="tw-flex tw-items-center tw-flex-col lg:tw-flex-row">
            <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mb-5 lg:tw-mb-0 tw-p-12 tw-rounded-xl tw-bg-neutral lg:tw-bg-transparent">
              <div className="tw-flex tw-flex-col">
                <div className="tw-font-bold tw-uppercase lg:tw-mb-2 tw-text-white">From</div>
                <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                  <div>
                    <div className="purplefade tw-uppercase tw-text-xl tw-font-bold">{token}</div>
                    <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(network => network.value === sourceNetwork)} onChange={this.changeSourceNetwork} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }} />
                  </div>
                </div>
              </div>
            </div>
            <button type="button" onClick={this.swapNetworks} className="tw-z-0 tw-p-2 tw-btn-accent lg:tw-w-1/6 tw-h-10 tw-content-center tw-rounded-lg outline-none focus:outline-none tw--my-4 lg:tw-mt-7 tw-relative lg:tw-static tw-transform tw-rotate-90 lg:tw-transform-none">
              <img className="tw-block tw-w-5 tw-h-5 tw-mx-auto" src="/assets/img/svg/arrows.svg" alt="" />
            </button>
            <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mt-5 tw-mb-5 lg:tw-mt-5 -mt-3 tw-bg-neutral lg:tw-bg-transparent tw-p-12 tw-rounded-xl">
              <div className="tw-flex tw-flex-col">
                <div className="tw-font-bold tw-uppercase lg:tw-mb-2 tw-text-white">To</div>
                <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                  <div>
                    <div className="purplefade tw-uppercase tw-text-xl tw-font-bold">{token}</div>
                    <Select styles={styles} options={targetNetworks} value={targetNetworks.find(network => network.value === targetNetwork)} onChange={this.changeTargetNetwork} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {tokensPending > 0
            ? <div className="tw-col-span-7 lg:bg-color lg:tw-px-14 tw-px-4 tw-rounded-xl tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl">
                <div className="tw-text-center tw-mb-14 tw-leading-normal">
                  <span className="tw-text-accent tw-font-medium">{scaleDownUnits(tokensPending)}</span> <span className="tw-text-white tw-font-bold">{`${token} ready to be received`}</span>
                </div>
                <button type="button" onClick={this.receiveTokens} className="tw-w-1/2 keybtn maxbtn">{networks[targetNetwork].id === networkId ? 'RECEIVE' : 'SWITCH NETWORK'}</button>
              </div>
            : <div className="md:tw-m-auto md:tw-w-1/2">
                <div className="tw-relative tw-mb-10 tw-flex">
                  <input type="number" min="1" max={availableAmount} placeholder={`Max: ${availableAmount}`} value={amount || ''} onChange={this.updateAmount} className="depositinput" />
                  <button type="button" className="dwmbtn hidesmmd" onClick={() => this.setAmount(availableAmount / 4)}>25%</button>
                  <button type="button" className="dwmbtn hidesmmd" onClick={() => this.setAmount(availableAmount / 2)}>50%</button>
                  <button type="button" className="dwmbtn hidesmmd" onClick={() => this.setAmount(availableAmount * 3 / 4)}>75%</button>
                  <button type="button" className="dwmbtn hidelg" onClick={() => this.setAmount(availableAmount / 4)}>&frac14;</button>
                  <button type="button" className="dwmbtn hidelg" onClick={() => this.setAmount(availableAmount / 2)}>&frac12;</button>
                  <button type="button" className="dwmbtn hidelg" onClick={() => this.setAmount(availableAmount * 3 / 4)}>&frac34;</button>
                  <button type="button" className="maxbtn" onClick={() => this.setAmount(availableAmount)}>Max</button>
                </div>
                <button type="button" onClick={this.sendTokens} disabled={amount === 0} className="keybtn maxbtn tw-w-full">{networks[sourceNetwork].id === networkId ? 'SEND' : 'SWITCH NETWORK'}</button>
                <div className="tw-col-span-5 tw-rounded-13 lg:tw-pt-10 lg:tw-bg-violet-900 tw-bg-transparent tw-relative">
                  {fee &&
                    <div>
                      <div className="tw-flex tw-justify-center purplefade tw-mb-7">
                        Receive Fee:
                        <div className="tw-ml-1.5 tw-text-white">{`${scaleDownPrecise(fee, 6)} ${networks[targetNetwork].symbol}`}</div>
                      </div>
                    </div>
                  }
                </div>
              </div>
          }
          <div className="tw-text-center tw-mt-2.5">
            <p style={{ color: this.state.success ? 'green' : 'red' }}>{message}</p>
          </div>
        </div>
      </div>;
    }

    return (
      <form className="tw-justify-center tw-mx-auto">
        <fieldset disabled={selectedAddress == null}>
          <div className="tw-font-Roboto tw-flex tw-flex-col tw-min-h-screen tw-bg-violet-900 tw-form-control">
            <div className="tw-flex-grow">
              <div className="tw-mx-auto tw-w-full lg:tw-max-w-5xl tw-px-4">
                <div className="lg:tw-grid tw-block">
                  <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.BRIDGE}</h1>
                  {bridge}
                </div>
              </div>
            </div>

            <footer className="tw-hidden lg:tw-block tw-bg-violet-900 tw-h-9" />
          </div>
        </fieldset>
      </form>
    );
  }
}
