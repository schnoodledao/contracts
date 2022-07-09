import React, { Component } from 'react';
import { general, farming } from '../resources';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import { handleError, getWeb3 } from '../helpers';

import { SwapWidget } from '@uniswap/widgets/dist/index.js';
import '@uniswap/widgets/dist/fonts.css';

const NATIVE = 'NATIVE';
const tokenListByNetworkId = {
  1: 'https://tokens.coingecko.com/uniswap/all.json',
  4: [
    {
      name: 'Schnoodle',
      address: SchnoodleV1.networks['4'].address,
      symbol: 'SNOOD',
      decimals: 18,
      chainId: 4,
      logoURI:
        'https://assets.coingecko.com/coins/images/17458/thumb/rc8zDq3.png?1654497345',
    },
  ],
};

const theme = {
  primary: '#ffffff',
  secondary: '#adb5bd',
  container: '#8a5af5',
  module: '#170c36',
  interactive: '#f3cc30',
  accent: '#b42a6f',
  outline: '#ced4da',
  dialog: '#170c36',
  error: '#dc3545',
  success: '#8a5af5',
  fontFamily: 'Verdana',
};

export class Home extends Component {
  static displayName = Home.name;

  constructor(props) {
    super(props);

    this.state = {};

    this.handleError = handleError.bind(this);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const networkId = await web3.eth.net.getId();
      const schnoodleTokenAddress = SchnoodleV1.networks[networkId].address;
      const tokenList = tokenListByNetworkId[networkId];

      this.setState({
        schnoodleTokenAddress,
        tokenList,
        provider: web3.currentProvider,
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  render() {
    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
          <div className="tw-flex tw-gap-10 tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
              <div className="maintitles tw-uppercase">{general.APP_NAME}</div>
              <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6"></div>
              <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading tw-uppercase">{farming.MOON_FARMING}</p>
              <a href="/farming">
                <button className="tw-px-4 tw-py-2 tw-mt-4 tw-text-lg tw-text-accent tw-border-accent tw-duration-200 tw-transform tw-border tw-rounded-lg hover:tw-bg-purple-100 focus:tw-outline-none">{farming.START_FARMING}</button>
              </a>
            </div>
            <div className="Uniswap">
              <SwapWidget
                provider={this.state.provider}
                jsonRpcEndpoint={process.env.REACT_APP_ETH_URL}
                tokenList={this.state.tokenList}
                defaultInputTokenAddress={NATIVE}
                defaultOutputTokenAddress={this.state.schnoodleTokenAddress}
                defaultInputAmount={1}
                theme={theme} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
