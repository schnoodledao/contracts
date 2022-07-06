import React, { Component } from 'react';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import { handleError, getWeb3 } from '../helpers';

import { SwapWidget } from '@uniswap/widgets/dist/index.js';
import '@uniswap/widgets/dist/fonts.css';

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
        'https://assets.coingecko.com/coins/images/17458/thumb/r    c8zDq3.png?1654497345',
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

export default class UniswapWidget extends Component {
  static displayName = UniswapWidget.name;

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
      <div className="Uniswap">
        <SwapWidget
          provider={this.state.provider}
          jsonRpcEndpoint={process.env.REACT_APP_ETH_URL}
          tokenList={this.state.tokenList}
          defaultOutputTokenAddress={this.state.schnoodleTokenAddress}
          defaultInputAmount={1}
          theme={theme}
        />
      </div>
    );
  }
}
