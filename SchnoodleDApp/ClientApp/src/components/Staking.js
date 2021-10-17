import React, { Component } from 'react';
import Schnoodle from "../contracts/SchnoodleV5.json";
import getWeb3 from "../getWeb3";
const bigInt = require("big-integer");

export class Staking extends Component {
  static displayName = Staking.name;

  constructor(props) {
    super(props);

    this.state = {
      success: false,
      message: null,
      web3: null,
      accounts: null,
      schnoodle: null,
      selectedAddress: null,
      decimals: null,
      stakingFundBalance: 0,
      stakingPoolBalance: 0,
      balance: 0,
      amountToStake: 1,
      stakedBalance: 0,
      stakingSummary: [],
      withdrawItems: []
    };

    this.addStake = this.addStake.bind(this);
    this.updateAmountToStake = this.updateAmountToStake.bind(this);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();

      const deployedNetwork = Schnoodle.networks[await web3.eth.net.getId()];
      const instance = new web3.eth.Contract(Schnoodle.abi, deployedNetwork && deployedNetwork.address);

      this.setState({ web3, accounts, schnoodle: instance, selectedAddress: web3.currentProvider.selectedAddress }, this.getInfo);

      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));
    } catch (err) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(err);
    }
  }

  async getInfo() {
    const { schnoodle, selectedAddress } = this.state;

    const decimals = await schnoodle.methods.decimals().call();
    this.setState({ decimals: decimals });
    const stakingFundBalance = await schnoodle.methods.balanceOf(await schnoodle.methods.stakingFund().call()).call();
    const stakingPoolBalance = await schnoodle.methods.balanceOf((await schnoodle.methods.staking().call())[0]).call();

    const balance = await schnoodle.methods.balanceOf(selectedAddress).call();
    const stakedBalance = await schnoodle.methods.stakedBalanceOf(selectedAddress).call();
    const stakingSummary = await schnoodle.methods.stakingSummary().call();

    let withdrawItems = [];
    for (let i = 0; i < stakingSummary.length; i++) {
      withdrawItems[i] = this.scaleDownUnits(stakingSummary[i].amount);
    }

    this.setState({ stakingFundBalance: stakingFundBalance, stakingPoolBalance: stakingPoolBalance, balance: balance, stakedBalance: stakedBalance, stakingSummary: stakingSummary, withdrawItems: withdrawItems });
  }

  scaleDownUnits(amount) {
    return bigInt(amount).divide(10 ** this.state.decimals).toJSNumber();
  }

  scaleUpUnits(amount) {
    return bigInt(amount).multiply(10 ** this.state.decimals);
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

    this.setState({ success: false, message: message });
    alert(message);
  }

  async addStake() {
    try {
      const { schnoodle, selectedAddress, amountToStake } = this.state;
      const response = await schnoodle.methods.addStake(this.scaleUpUnits(amountToStake).toString()).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async withdrawStake(i) {
    try {
      const { schnoodle, selectedAddress, withdrawItems } = this.state;
      const response = await schnoodle.methods.withdrawStake(i, this.scaleUpUnits(withdrawItems[i]).toString()).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  updateWithdrawItem(i, e) {
    let withdrawItems = this.state.withdrawItems;
    withdrawItems[i] = e.target.value;
    this.setState({ withdrawItems: withdrawItems });
  }

  updateAmountToStake(e) {
    const amountToStake = e.target.value;
    this.setState({ amountToStake: amountToStake ? amountToStake : 0 });
  }

  renderStakingSummaryTable(stakingSummary) {
    const withdraw = 'Withdraw';

    return (
      <table className='table table-striped' aria-labelledby="tabelLabel">
        <thead>
          <tr>
            <th>Block Number</th>
            <th>Amount</th>
            <th>Withdraw</th>
            <th>Claimable Reward</th>
          </tr>
        </thead>
        <tbody>
          {stakingSummary.map((stake, i) => {
            const amount = this.scaleDownUnits(stake.amount);
            return (
              <tr key={stake.blockNumber}>
                <td>{stake.blockNumber}</td>
                <td>{amount}</td>
                <td>
                  <button className='btn btn-primary' disabled={this.state.withdrawItems[i] < 1 || this.state.withdrawItems[i] > amount} onClick={this.withdrawStake.bind(this, i)}>{withdraw}</button>
                  <span style={{ paddingLeft: 10 }}><input type='number' min='1' max={amount} value={this.state.withdrawItems[i]} onChange={this.updateWithdrawItem.bind(this, i)} /></span>
                </td>
                <td>{this.scaleDownUnits(stake.claimable)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  render() {
    const stake = 'Stake';
    const balance = this.scaleDownUnits(this.state.balance);
    const stakedBalance = this.scaleDownUnits(this.state.stakedBalance);
    const stakeableAmount = balance - stakedBalance;

    if (!this.state.web3) {
      return <div>Loading...</div>;
    }
    return (
      <div>
        <h1>Staking</h1>

        <div>Staking fund balance: {this.scaleDownUnits(this.state.stakingFundBalance)}</div>
        <div>Staking pool balance: {this.scaleDownUnits(this.state.stakingPoolBalance)}</div>
        <p />
        <strong>Your Tokens</strong>
        <div>Total balance: {balance}</div>
        <div>Staked balance: {stakedBalance}</div>
        <div>Stakeable amount: {stakeableAmount}</div>
        <p />
        <strong>Add Stake</strong>
        <form>
          <fieldset disabled={stakeableAmount == 0}>
            <input type='number' min='1' max={stakeableAmount} value={this.state.amountToStake} onChange={this.updateAmountToStake} />
            <span style={{ paddingLeft: 10 }}><button className='btn btn-primary' disabled={this.state.amountToStake < 1 || this.state.amountToStake > stakeableAmount} onClick={this.addStake}>{stake}</button></span>
          </fieldset>
        </form>
        <p />
        <strong>Your Stakes</strong>
        <div>{this.renderStakingSummaryTable(this.state.stakingSummary)}</div>
        <p />
        <p style={{ color: this.state.success ? 'green' : 'red' }}>{this.state.message}</p>
      </div>
    );
  }
}
