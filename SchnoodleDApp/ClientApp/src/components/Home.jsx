import React, { Component } from 'react';
import { general, farming } from '../resources';
import { SwapWidget } from '@uniswap/widgets';

export class Home extends Component {
  static displayName = Home.name;

  render () {

    const uniswapTokenList = 'https://tokens.coingecko.com/uniswap/all.json';
    const SNOOD = '0xd45740ab9ec920bedbd9bab2e863519e59731941';
    const theme = {
      primary: '#ffffff',
      secondary: '#ffffff',
      interactive: '#AD73B1',
      container: '#702DDC',
      module: '#20134E',
      accent: '#9999CC',
      outline: '#CC1',
      dialog: '#140A2E',
      fontFamily: 'Josefin Sans',
      borderRadius: 1
    }

    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
          <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
              <div className="maintitles tw-uppercase">{general.APP_NAME}</div>
              <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6"></div>
              <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading tw-uppercase">{farming.MOON_FARMING}</p>
              <a href="/farming">
                <button className="tw-px-4 tw-py-2 tw-mt-4 tw-text-lg tw-text-accent tw-border-accent tw-duration-200 tw-transform tw-border tw-rounded-lg hover:tw-bg-purple-100 focus:tw-outline-none">{farming.START_FARMING}</button>
              </a>
                 <div className="tw-flex tw-justify-center tw-m-10 ">
                        <SwapWidget
                          provider={window.web3.currentProvider}
                         jsonRpcEndpoint={process.env.REACT_APP_ETH_URL}
                         tokenList={uniswapTokenList}
                         theme={theme}
                         defaultInputTokenAddress={SNOOD}
                        />
                  </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
