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
      lockBlocks: 1,
      stakedBalance: 0,
      stakingSummary: [],
      blockNumber: 0,
      withdrawItems: []
    };

    this.stakeAll = this.stakeAll.bind(this);
    this.addStake = this.addStake.bind(this);
    this.updateAmountToStake = this.updateAmountToStake.bind(this);
    this.updateLockBlocks = this.updateLockBlocks.bind(this);
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
    const { web3, schnoodle, selectedAddress } = this.state;

    const decimals = await schnoodle.methods.decimals().call();
    this.setState({ decimals: decimals });
    const stakingFundBalance = await schnoodle.methods.balanceOf(await schnoodle.methods.stakingFund().call()).call();
    const stakingPoolBalance = await schnoodle.methods.balanceOf((await schnoodle.methods.staking().call())[0]).call();

    const balance = await schnoodle.methods.balanceOf(selectedAddress).call();
    const stakedBalance = await schnoodle.methods.stakedBalanceOf(selectedAddress).call();
    const stakingSummary = [].concat(await schnoodle.methods.stakingSummary().call()).sort((a, b) => a.blockNumber > b.blockNumber ? 1 : -1);
    const blockNumber = await web3.eth.getBlockNumber();

    let withdrawItems = [];
    for (let i = 0; i < stakingSummary.length; i++) {
      withdrawItems[i] = this.scaleDownUnits(stakingSummary[i].amount);
    }

    this.setState({ stakingFundBalance: stakingFundBalance, stakingPoolBalance: stakingPoolBalance, balance: balance, stakedBalance: stakedBalance, stakingSummary: stakingSummary, blockNumber: blockNumber, withdrawItems: withdrawItems });
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

  stakeAll() {
    this.setState({ amountToStake: this.scaleDownUnits(this.state.balance - this.state.stakedBalance) });
  }

  async addStake() {
    try {
      const { schnoodle, selectedAddress, amountToStake, lockBlocks } = this.state;
      const response = await schnoodle.methods.addStake(this.scaleUpUnits(amountToStake).toString(), lockBlocks).send({ from: selectedAddress });
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
    this.setState({ amountToStake: amountToStake });
  }

  updateLockBlocks(e) {
    const lockBlocks = e.target.value;
    this.setState({ lockBlocks: lockBlocks });
  }

  renderStakingSummaryTable(stakingSummary) {
    const withdraw = 'Withdraw';

    return (
      <table className='table table-striped w-full text-2xl mb-6 md:mb-10 border-collapse border border-secondary' aria-labelledby="tabelLabel">
        <thead>
          <tr>
            <th><span class="hidemd">B/N</span><span class="hidesm">Block Number</span></th>
            <th>Amount</th>
            <th>Remaining Lock Blocks</th>
            <th>Withdraw</th>
            <th><span class="hidemd">Claimable</span><span class="hidesm">Claimable Reward</span></th>
          </tr>
        </thead>
        <tbody class='text-2xl'>
          {stakingSummary.map((stake, i) => {
            const amount = this.scaleDownUnits(stake.amount);
            return (
              <tr key={stake.blockNumber}>
                <td>{stake.blockNumber}</td>
                <td>{amount}</td>
                <td>{Math.max(0, parseInt(stake.blockNumber) + parseInt(stake.lockBlocks) - this.state.blockNumber)}</td>
                <td>
                  <button className='md:btn md:btn-secondary btn-sm pl-0 md:pl-3 mt-2 md:mt-0' disabled={this.state.withdrawItems[i] < 1 || this.state.withdrawItems[i] > amount} onClick={this.withdrawStake.bind(this, i)}>{withdraw}</button>
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
      return (
        <div class="overflow-hidden antialiased font-roboto">
          <div class="min-h-screen md:flex">
            <div class="flex items-center justify-center fullhalfwidth">
              <div class="max-w-lg">
                <img class="object-cover w-full my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles">STAKING</div>
                <div class="w-16 h-1 my-3 bg-secondary md:my-6"></div>
                <p class="text-4xl font-light leading-normal text-gray-600 md:text-5xl loading">Loading<span>.</span><span>.</span><span>.</span></p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="min-h-screen bg-neutral-focus mx-2 md:m-auto font-roboto">
        <div class="text-center container">
          <div class="text-base-200 w-full">
            <h1 class="mt-10 mb-2 maintitles leading-tight text-center md:text-left uppercase">Staking</h1>
            <p class="my-2 text-2xl md:text-3xl leading-tight titlefont w-2/3 md:w-full m-auto md:mx-0 textfade from-green-400 to-purple-500">
              <span class="block md:hidden text-center">Stake SNOOD tokens,<br/>get SNOOD tokens</span>
              <span class="hidden md:block text-left">Stake SNOOD tokens, get SNOOD tokens</span>
            </p>
      
            <div class="stats topstats">
              <div class="stat">
                <div class="stat-title">Staking fund balance</div>
                <div class="stat-value greenfade">{this.scaleDownUnits(this.state.stakingFundBalance)}</div>
                <div class="stat-desc text-secondary">SNOOD</div>
              </div>
              <div class="stat">
              <div class="stat-title">Staking pool balance</div>
                <div class="stat-value greenfade">{this.scaleDownUnits(this.state.stakingPoolBalance)}</div>
                <div class="stat-desc text-secondary">SNOOD</div>
              </div>
            </div>

            <div class="card shadow-sm text-accent-content mt-5 mb-5 container-lg">
              <div class="card-body my-6 md:my-10 rounded-4xl">
                <h2 class="card-title headingfont text-purple-500"><span class="purplefade">Your SNOOD Tokens</span></h2>
                <div class="shadow bottomstats stats ">
                  <div class="stat">
                    <div class="stat-title">Total balance</div>
                    <div class="stat-value purplefade">{balance}</div>
                    <div class="stat-desc">SNOOD</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Staked balance</div>
                    <div class="stat-value purplefade">{stakedBalance}</div>
                    <div class="stat-desc">SNOOD</div>
                  </div>
                    <div class="stat ">
                    <div class="stat-title">Stakeable amount</div>
                    <div class="stat-value purplefade">{stakeableAmount}</div>
                    <div class="stat-desc">SNOOD</div>
                  </div>
                </div>
                <div class="divider mt-10">
                  <h3 class="staketitle text-2xl md:text-3xl leading-tight">Add Stake</h3>
                </div>

                <div class="card-actions text-center mx-auto w-full">
                  <form class="form-control justify-center fullhalfwidth mx-auto mt-5">
                    <fieldset disabled={stakeableAmount === 0 }>
                      <div class="flex flex-col">
                        <div>
                          <label class="label">
                            <span class="label-text">Amount</span>
                          </label> 
                          <div class="relative">
                            <input type='number' min='1' max={stakeableAmount} value={this.state.amountToStake} onChange={this.updateAmountToStake} class="stakeinput pr-16" />
                            <button type="button" class="absolute top-0 right-0 rounded-l-none btn btn-accent opacity-80 bordered border-accent text-base-300 text-lg" onClick={this.stakeAll}>ALL</button>
                          </div>
                        </div>
                        <div class="mb-3">
                          <label class="label">
                            <span class="label-text">Lock blocks</span>
                          </label> 
                          <input type='number' min='1' value={this.state.lockBlocks} onChange={this.updateLockBlocks} class="stakeinput" />
                        </div>
                        <button type="button" className='btn btn-accent mt-5 text-xl font-black' disabled={this.state.amountToStake < 1 || this.state.lockBlocks < 1 || this.state.amountToStake > stakeableAmount} onClick={this.addStake}>{stake}</button>
                      </div>
                    </fieldset>
                  </form>
                </div>
              </div>
            </div>

            <h3 class="mb-5 headingfont staketitle mt-10">Your Stakes</h3>
            <div class="overflow-x-auto text-secondary my-5 ">
              {this.renderStakingSummaryTable(this.state.stakingSummary)}
            </div>
            <div class="my-5">
              <p style={{ color: this.state.success ? 'green' : 'red' }}>{this.state.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
