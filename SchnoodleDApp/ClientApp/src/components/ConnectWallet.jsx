import React, { Component } from 'react';
import './Bridge.css'

export class ConnectWallet extends Component {
  constructor(props) {
    super(props);

    this.state = {
      theme: '',
      account: null
    }

    this.connect = this.connect.bind(this);
  }

  componentDidMount = async () => {
    this.setState({ account: localStorage.getItem('account') });

    const { ethereum } = window;

    // Check if MetaMask is installed
    if (ethereum && ethereum.isMetaMask) {
      window.ethereum.on('accountsChanged', async () => {
         await this.connect();
      });

      window.ethereum.on('chainChanged', () => {
        this.props.checkNetwork();
        this.props.resetApprove();
        this.props.updateApproval();
      });
    }
  }

  async connect() {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    let account = null;
    this.props.resetErrorsFunc();
    this.props.resetApprove();

    if (accounts.length > 0) {
      account = accounts[0];
      localStorage.setItem('account', account);
      this.props.checkNetwork();
      this.props.updateApproval();
    }

    this.setState({ account });
  }

  render() {
    const className = 'min-w-min lg:text-sm text-xs font-medium lg:py-4 lg:px-6 py-2 px-4 rounded transition-all duration-200 bg-gradient-to-b via-btn-to from-purple-from to-purple-to shadow-sm hover:bg-main-color-hover text-white outline-none focus:outline-none';

    if (this.state.account === null) {
      return (
        <button onClick={this.connect} className={className}>Connect Wallet</button>
      );
    } else {
      return (
        <div className={className}>{this.state.account.slice(0, 6) + '...' + this.state.account.slice(-6)}</div>
      );
    }
  }
}
