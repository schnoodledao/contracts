import React, { Component } from 'react';
import Schnoodle from "../contracts/SchnoodleV5.json";
import getWeb3 from "../getWeb3";
const bigInt = require("big-integer");

export class Staking extends Component {
  static displayName = Staking.name;

  constructor(props) {
    super(props);
    this.state = {
      web3: null,
      accounts: null,
      schnoodle: null,
      selectedAddress: null,
      decimals: null,
      stakingFundBalance: 0,
      stakingPoolBalance: 0,
      balance: 0,
      stakedBalance: 0,
      stakingSummary: [],
      amountToStake: 0
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
    } catch (error) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(error);
    }
  }

  async getInfo() {
    const { web3, schnoodle, selectedAddress } = this.state;

    const decimals = await schnoodle.methods.decimals().call();
    const stakingFundBalance = await schnoodle.methods.balanceOf(await schnoodle.methods.stakingFund().call()).call();
    const stakingPoolBalance = await schnoodle.methods.balanceOf((await schnoodle.methods.staking().call())[0]).call();

    const balance = await schnoodle.methods.balanceOf(selectedAddress).call();
    const stakedBalance = await schnoodle.methods.stakedBalanceOf(selectedAddress).call();
    const stakingSummary = await schnoodle.methods.stakingSummary().call();

    this.setState({ decimals: decimals, stakingFundBalance: stakingFundBalance, stakingPoolBalance: stakingPoolBalance, balance: balance, stakedBalance: stakedBalance, stakingSummary: stakingSummary });
  }

  scaleDownUnits(amount) {
    return bigInt(amount).divide(10 ** this.state.decimals).toJSNumber();
  }

  scaleUpUnits(amount) {
    return bigInt(amount).multiply(10 ** this.state.decimals);
  }

  async addStake() {
    const { web3, accounts, schnoodle, selectedAddress, amountToStake } = this.state;

    await schnoodle.methods.addStake(this.scaleUpUnits(amountToStake).toString()).send({ from: selectedAddress });
  }

  async withdrawStake(index, amount) {
    const { web3, accounts, schnoodle, selectedAddress, amountToStake } = this.state;

    await schnoodle.methods.withdrawStake(index, amount).send({ from: selectedAddress });
  }

  async updateAmountToStake(e) {
    const amountToStake = parseInt(e.target.value);
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
          </tr>
        </thead>
        <tbody>
          {stakingSummary.map((stake, index) =>
            <tr key={stake.blockNumber}>
              <td>{stake.blockNumber}</td>
              <td>{this.scaleDownUnits(stake.amount)}</td>
              <td><button className='btn btn-primary' onClick={() => this.withdrawStake(index, stake.amount)}>{withdraw}</button></td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  render() {
    const stake = 'Stake';

    if (!this.state.web3) {
      return <div>Loading...</div>;
    }
    return (
      <div>
        <h1>Staking</h1>

        <div>Staking fund balance: {this.scaleDownUnits(this.state.stakingFundBalance)}</div>
        <div>Staking pool balance: {this.scaleDownUnits(this.state.stakingPoolBalance)}</div>

        <div>Your balance: {this.scaleDownUnits(this.state.balance)}</div>
        <div>Staked balance: {this.scaleDownUnits(this.state.stakedBalance)}</div>
        <div>Staking summary: {this.renderStakingSummaryTable(this.state.stakingSummary)}</div>

        <strong>Amount to Stake:</strong>
        <p><input type='text' placeholder='1000' value={this.state.amountToStake} onChange={this.updateAmountToStake} /></p>
        <button className='btn btn-primary' onClick={this.addStake}>{stake}</button>
      </div>
    );
  }
}
