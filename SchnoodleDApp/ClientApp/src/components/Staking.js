import React, { Component } from 'react';
import Schnoodle from "../contracts/SchnoodleV5.json";
import SchnoodleStaking from "../contracts/SchnoodleStakingV1.json";
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
      schnoodle: null,
      schnoodleStaking: null,
      selectedAddress: null,
      decimals: null,
      stakingFundBalance: 0,
      balance: 0,
      tripMeter: {"blockNumber": 0, "netBalance": 0},
      amountToStake: 1,
      vestingBlocks: 1,
      stakedBalance: 0,
      stakingSummary: [],
      blockNumber: 0,
      withdrawItems: []
    };

    this.stakeAll = this.stakeAll.bind(this);
    this.addStake = this.addStake.bind(this);
    this.resetTripMeter = this.resetTripMeter.bind(this);
    this.updateAmountToStake = this.updateAmountToStake.bind(this);
    this.updateVestingBlocks = this.updateVestingBlocks.bind(this);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();

      const schnoodleDeployedNetwork = Schnoodle.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleStakingDeployedNetwork = SchnoodleStaking.networks[await web3.eth.net.getId()];
      const schnoodleStaking = new web3.eth.Contract(SchnoodleStaking.abi, schnoodleStakingDeployedNetwork && schnoodleStakingDeployedNetwork.address);

      this.setState({ web3, schnoodle: schnoodle, schnoodleStaking: schnoodleStaking, selectedAddress: web3.currentProvider.selectedAddress }, this.getInfo);

      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));
    } catch (err) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(err);
    }
  }

  async getInfo() {
    const { web3, schnoodle, schnoodleStaking, selectedAddress } = this.state;

    const decimals = await schnoodle.methods.decimals().call();
    this.setState({ decimals: decimals });
    const stakingFundBalance = await schnoodle.methods.balanceOf(await schnoodle.methods.stakingFund().call()).call();

    const balance = await schnoodle.methods.balanceOf(selectedAddress).call();
    const tripMeter = await schnoodle.methods.tripMeter(selectedAddress).call();
    const stakedBalance = await schnoodleStaking.methods.stakedBalanceOf(selectedAddress).call();
    const stakingSummary = [].concat(await schnoodleStaking.methods.stakingSummary(selectedAddress).call()).sort((a, b) => a.blockNumber > b.blockNumber ? 1 : -1);
    const blockNumber = await web3.eth.getBlockNumber();

    let withdrawItems = [];
    for (let i = 0; i < stakingSummary.length; i++) {
      withdrawItems[i] = this.scaleDownUnits(stakingSummary[i].amount);
    }

    this.setState({ stakingFundBalance: stakingFundBalance, balance: balance, tripMeter: tripMeter, stakedBalance: stakedBalance, stakingSummary: stakingSummary, blockNumber: blockNumber, withdrawItems: withdrawItems });
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
      const { schnoodleStaking, selectedAddress, amountToStake, vestingBlocks } = this.state;
      const response = await schnoodleStaking.methods.addStake(this.scaleUpUnits(amountToStake).toString(), vestingBlocks).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async withdrawStake(i) {
    try {
      const { schnoodleStaking, selectedAddress, withdrawItems } = this.state;
      const response = await schnoodleStaking.methods.withdraw(i, this.scaleUpUnits(withdrawItems[i]).toString()).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async resetTripMeter() {
    try {
      const { schnoodle, selectedAddress } = this.state;
      const response = await schnoodle.methods.resetTripMeter().send({ from: selectedAddress });
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

  updateVestingBlocks(e) {
    const vestingBlocks = e.target.value;
    this.setState({ vestingBlocks: vestingBlocks });
  }

  renderStakingSummaryTable(stakingSummary) {
    return (
      <table className='table table-striped w-full mb-6 md:mb-10 border-collapse border border-secondary' aria-labelledby="tabelLabel">
        <thead>
          <tr>
            <th class="hidden md:table-cell">Block Number</th>
            <th><span class="hidemd">Staked<br/>Amount</span><span class="hidesm">Staked Amount</span></th>
            <th><span class="hidemd">Blocks<br/>Pending</span><span class="hidesm">Blocks Pending</span></th>
            <th>Withdraw</th>
            <th><span class="hidemd">Claimable<br />Rewards</span><span class="hidesm">Claimable Reward</span></th>
          </tr>
        </thead>
        <tbody class=''>
          {stakingSummary.map((stake, i) => {
            const amount = this.scaleDownUnits(stake.amount);
            const blocksPending = Math.max(0, parseInt(stake.blockNumber) + parseInt(stake.vestingBlocks) - this.state.blockNumber);
            return (
              <tr key={stake.blockNumber}>
                <td class="hidden md:table-cell">{stake.blockNumber}</td>
                <td>{amount}</td>
                <td>{blocksPending}</td>
                <td>
                  <form>
                    <fieldset disabled={blocksPending > 0}>
                    <div class="relative">
                      <div class="form-control">
                        <input type="number" min="1" max={amount} value={this.state.withdrawItems[i]} onChange={this.updateWithdrawItem.bind(this, i)} class="withdrawinput"/>
                        <button type="button" class="text-xs lg:text-base xl:text-xl absolute top-0 right-0 rounded-l-none btn btn-secondary text-base-300 px-1 lg:px-3 xl:px-8" disabled={this.state.withdrawItems[i] < 1 || this.state.withdrawItems[i] > amount} onClick={this.withdrawStake.bind(this, i)}><span class="hidemd">Withdraw</span><span class="hidesm">Withdraw</span></button>
                      </div>
                      </div>
                    </fieldset>
                  </form>
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
    const balance = this.scaleDownUnits(this.state.balance);
    const stakedBalance = this.scaleDownUnits(this.state.stakedBalance);
    const stakeableAmount = balance - stakedBalance;

    const token = 'SNOOD';
    const stakeTokens = `Stake ${token} tokens.`;
    const earnTokens = `Earn ${token} tokens.`;

    if (this.state.web3) {
      return (
        <div class="overflow-hidden antialiased font-roboto mx-4">  
          <div class="h-noheader md:flex">
            <div class="flex items-center justify-center w-full">
              <div class="px-4">
              <img class="object-cover w-1/2 my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles">SCHNOODLE X</div>
                <div class="w-16 h-1 my-3 bg-secondary md:my-6"></div>
                <p class="text-4xl font-light leading-normal text-accent md:text-5xl loading">Loading<span>.</span><span>.</span><span>.</span></p>
                <div class="px-4 mt-4" style="height:37px">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="m-auto px-4 max-w-screen-2xl">
        <div class="h-noheader overflow-hidden bg-neutral-focus mx-2 md:m-auto font-roboto">
          <div class="text-center px-1 md:px-4 ">
            <div class="text-base-200 w-full ">
              <h1 class="mt-10 mb-2 maintitles leading-tight text-center md:text-left uppercase">Staking</h1>
              <p class="my-2 text-2xl md:text-3xl leading-tight titlefont w-2/3 md:w-full m-auto md:mx-0 textfade from-green-400 to-purple-500">
                <span class="block md:hidden text-center">{stakeTokens}<br />{earnTokens}</span>
                <span class="hidden md:block text-left">{stakeTokens} {earnTokens}</span>
              </p>
        
              <div class="stats topstats">
                <div class="stat">
                  <div class="stat-title">Staking fund balance</div>
                  <div class="stat-value greenfade">{this.scaleDownUnits(this.state.stakingFundBalance)}</div>
                  <div class="stat-desc text-secondary">{token}</div>
                </div>

                {this.state.tripMeter.blockNumber > 0 && (
                  <div class="stat">
                    <div class="stat-title">BARK rewards</div>
                    <div class="stat-value greenfade">
                      {this.scaleDownUnits(this.state.balance - this.state.tripMeter.netBalance)}
                      &nbsp;<input class="max-h-8" type="image" src="../../assets/img/svg/reset-button.svg" onClick={this.resetTripMeter} title="Reset" />
                    </div>
                    <div class="stat-desc text-secondary">{token} since block {this.state.tripMeter.blockNumber}</div>
                  </div>
                )}
              </div>

              <div class="card shadow-sm border-purple-500 border-4 rounded-2xl text-accent-content mt-5 mb-5 container-lg">
                <div class="card-body my-6 md:my-10 rounded-4xl">
                  <h2 class="card-title headingfont text-purple-500"><span class="purplefade">Your {token} Tokens</span></h2>
                  <div class="shadow-sm bottomstats stats ">
                    <div class="stat">
                      <div class="stat-title">Total balance</div>
                      <div class="stat-value purplefade">{balance}</div>
                      <div class="stat-desc">{token}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-title">Staked balance</div>
                      <div class="stat-value purplefade">{stakedBalance}</div>
                      <div class="stat-desc">{token}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-title">Stakeable amount</div>
                      <div class="stat-value purplefade">{stakeableAmount}</div>
                      <div class="stat-desc">{token}</div>
                    </div>
                  </div>
                  <div class="divider mt-10">
                    <h3 class="staketitle text-2xl md:text-3xl leading-tight">Add Stake</h3>
                  </div>

                  <div class="card-actions text-center mx-auto w-full">
                    <form class=" justify-center fullhalfwidth mx-auto mt-5">
                      <fieldset disabled={stakeableAmount === 0}>
                        <div class="form-control">
                          <div>
                            <label class="label">
                              <span class="label-text">Amount</span>
                            </label> 
                            <div class="relative">
                              <input type='number' min='1' max={stakeableAmount} value={this.state.amountToStake} onChange={this.updateAmountToStake} class="stakeinput" />
                              <button type="button" class="absolute top-0 right-0 rounded-l-none btn btn-accent opacity-80 bordered border-accent text-base-300 text-lg uppercase" onClick={this.stakeAll}>All</button>
                            </div>
                          </div>
                        </div>
                        <div class="mb-3 form-control">
                          <label class="label">
                            <span class="label-text">Vesting blocks</span>
                          </label>
                          <input type="number" min="1" value={this.state.vestingBlocks} onChange={this.updateVestingBlocks} class="stakeinput" />
                        </div>
                        <div class="mb-3 form-control">
                          <button type="button" className='btn btn-accent mt-5 text-xl font-black' disabled={this.state.amountToStake < 1 || this.state.vestingBlocks < 1 || this.state.amountToStake > stakeableAmount} onClick={this.addStake}>Stake</button>
                        </div>
                      </fieldset>
                    </form>
                  </div>
                </div>
              </div>

              {this.state.stakingSummary.length > 0 && (
                <div class="staketable">
                  <h3 class="mb-5 headingfont staketitle mt-10">Your Stakes</h3>
                  <div class="overflow-x-auto text-secondary my-5 ">
                    {this.renderStakingSummaryTable(this.state.stakingSummary)}
                  </div>
                </div>
              )}

              <div class="my-5">
                <p style={{ color: this.state.success ? 'green' : 'red' }}>{this.state.message}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
