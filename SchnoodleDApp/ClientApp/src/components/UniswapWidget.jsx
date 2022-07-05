import React, { Component } from 'react';

import { SwapWidget } from '@uniswap/widgets/dist/index.js';
import '@uniswap/widgets/dist/fonts.css';

const uniswapTokenList = 'https://tokens.coingecko.com/uniswap/all.json';
const nativeToken = 'NATIVE';
const schnoodleToken = '0xD45740aB9ec920bEdBD9BAb2E863519E59731941';

const theme = {
  primary: '#ffffff',
  secondary: '#adb5bd',
  container: '#8a5af5',
  module: '#170C36',
  interactive: '#f3cc30',
  accent: '#b42a6f',
  outline: '#ced4da',
  dialog: '#1d1249',
  error: '#dc3545',
  success: '#8d38d7',
  fontFamily: 'Verdana',
};

export default class UniswapWidget extends Component {
  static displayName = UniswapWidget.name;

  render() {
    return (
      <div className="Uniswap">
        <SwapWidget
          provider={window.ethereum || window.web3.currentProvider}
          jsonRpcEndpoint={process.env.REACT_APP_ETH_URL}
          tokenList={uniswapTokenList}
          defaultInputTokenAddress={nativeToken}
          defaultOutputTokenAddress={schnoodleToken}
          defaultInputAmount={1}
          theme={theme}
        />
      </div>
    );
  }
}
