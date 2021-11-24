import React, { Component } from 'react';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV7 from "../contracts/SchnoodleV7.json";
import SchnoodleStaking from "../contracts/SchnoodleStakingV1.json";
import getWeb3 from "../getWeb3";
import debounce from 'lodash.debounce';
const bigInt = require("big-integer");
const { Duration } = require("luxon");
const humanizeDuration = require("humanize-duration");

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
      getInfoIntervalId: 0,
      decimals: null,
      stakingFundBalance: 0,
      blockNumber: 0,
      averageBlockTime: 0,
      operativeFeeRate: 0,
      donationRate: 0,
      stakingRate: 0,
      sellQuota: { 'blockMetric': 0, 'amount': 0 },
      balance: 0,
      reflectTrackerInfo: { 'blockNumber': 0, 'deltaBalance': 0 },
      amountToStake: 0,
      vestingBlocks: 1,
      vestingBlocksMax: 0,
      unbondingBlocks: 1,
      unbondingBlocksMax: 0,
      vestForecastReward: 0,
      apy: 0,
      stakedBalance: 0,
      stakeableAmount: 0,
      stakingSummary: [],
      unbondingSummary: [],
      withdrawItems: []
    };

    this.stakeAll = this.stakeAll.bind(this);
    this.addStake = this.addStake.bind(this);
    this.resetReflectTracker = this.resetReflectTracker.bind(this);
    this.updateAmountToStake = this.updateAmountToStake.bind(this);
    this.updateVestingBlocks = this.updateVestingBlocks.bind(this);
    this.updateUnbondingBlocks = this.updateUnbondingBlocks.bind(this);

    this.updateForecastReward = debounce(this.updateForecastReward, 250);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();

      const schnoodleDeployedNetwork = SchnoodleV1.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(SchnoodleV7.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleStakingDeployedNetwork = SchnoodleStaking.networks[await web3.eth.net.getId()];
      const schnoodleStaking = new web3.eth.Contract(SchnoodleStaking.abi, schnoodleStakingDeployedNetwork && schnoodleStakingDeployedNetwork.address);

      this.setState({ web3, schnoodle, schnoodleStaking, selectedAddress: web3.currentProvider.selectedAddress }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 10000);
        this.setState({ getInfoIntervalId });
      });

      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));
    } catch (err) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.getInfoIntervalId);
    this.updateForecastReward.cancel();
  }

  async getInfo() {
    const { web3, schnoodle, schnoodleStaking, selectedAddress } = this.state;

    const decimals = await schnoodle.methods.decimals().call();
    const blockNumber = await web3.eth.getBlockNumber();

    let averageBlockTime;
    if (blockNumber > 0) {
      const blocksDenominator = Math.min(500, blockNumber);
      averageBlockTime = ((await web3.eth.getBlock(blockNumber)).timestamp - (await web3.eth.getBlock(blockNumber - blocksDenominator)).timestamp) / blocksDenominator;
    }

    this.setState({ decimals, blockNumber, averageBlockTime }, async () => {
      const operativeFeeRate = await schnoodle.methods.getOperativeFeeRate().call();
      const { 1: donationRate } = await schnoodle.methods.eleemosynary().call();
      const stakingRate = await schnoodle.methods.stakingRate().call();
      const sellQuota = await schnoodle.methods.sellQuota().call();
      const stakingFundBalance = bigInt(await schnoodle.methods.balanceOf(await schnoodle.methods.stakingFund().call()).call());

      const balance = bigInt(await schnoodle.methods.balanceOf(selectedAddress).call());
      const { 0: blockNumber, 1: deltaBalance } = await schnoodle.methods.reflectTrackerInfo(selectedAddress).call();
      const stakedBalance = bigInt(await schnoodleStaking.methods.stakedBalanceOf(selectedAddress).call());
      const stakeableAmount = bigInt(balance - stakedBalance);
      const vestingBlocksMax = this.blocksPerDuration({ years: 1 });
      const unbondingBlocksMax = this.blocksPerDuration({ years: 1 });

      // Fetch the staking summary while also calculating the APY for each stake
      const stakingSummary = await Promise.all([].concat(await schnoodleStaking.methods.stakingSummary(selectedAddress).call()).sort((a, b) => a.stake.blockNumber > b.stake.blockNumber ? 1 : -1).map(async (stakeReward, i) => {
        const apy = this.calculateApy(stakeReward.stake.amount, await schnoodleStaking.methods.reward(selectedAddress, i, await this.blockNumberAfterOneYear()).call())
        return { stake: bigInt(stakeReward.stake), reward: bigInt(stakeReward.reward), apy: apy };
      }));

      const unbondingSummary = [].concat(await schnoodleStaking.methods.unbondingSummary(selectedAddress).call()).sort((a, b) => a.expiryBlock > b.expiryBlock ? 1 : -1);

      let withdrawItems = [];
      for (let i = 0; i < stakingSummary.length; i++) {
        withdrawItems[i] = this.scaleDownUnits(stakingSummary[i].stake.amount);
      }

      this.setState({
        stakingFundBalance,
        operativeFeeRate,
        donationRate,
        stakingRate,
        sellQuota,
        balance,
        reflectTrackerInfo: { blockNumber, deltaBalance },
        vestingBlocksMax,
        unbondingBlocksMax,
        stakedBalance,
        stakeableAmount,
        stakingSummary,
        unbondingSummary,
        withdrawItems
      });
    });
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

    this.setState({ success: false, message });
    alert(message);
  }

  async addStake() {
    try {
      const { schnoodleStaking, selectedAddress, amountToStake, vestingBlocks, unbondingBlocks } = this.state;
      const response = await schnoodleStaking.methods.addStake(amountToStake.toString(), vestingBlocks, unbondingBlocks).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async withdrawStake(index) {
    try {
      const { schnoodleStaking, selectedAddress, withdrawItems } = this.state;
      const response = await schnoodleStaking.methods.withdraw(index, this.scaleUpUnits(withdrawItems[index]).toString()).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async resetReflectTracker() {
    try {
      const { schnoodle, selectedAddress } = this.state;
      const response = await schnoodle.methods.resetReflectTracker().send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async stakeAll() {
    this.setState({ amountToStake: this.state.stakeableAmount }, async () => await this.updateForecastReward());
  }

  updateWithdrawItem(index, e) {
    let withdrawItems = this.state.withdrawItems;
    withdrawItems[index] = e.target.value;
    this.setState({ withdrawItems });
  }

  async updateAmountToStake(e) {
    const amountToStake = e.target.value === '' ? 0 : parseInt(e.target.value);
    if (!Number.isInteger(amountToStake)) return;
    this.setState({ amountToStake: bigInt(Math.min(this.scaleUpUnits(amountToStake), this.state.stakeableAmount)) }, async () => await this.updateForecastReward());
  }

  async updateVestingBlocks(e) {
    const vestingBlocks = e.target.value === '' ? 0 : parseInt(e.target.value);
    if (!Number.isInteger(vestingBlocks)) return;
    this.setState({ vestingBlocks: Math.min(vestingBlocks, this.state.vestingBlocksMax) }, async () => await this.updateForecastReward());
  }

  async updateUnbondingBlocks(e) {
    const unbondingBlocks = e.target.value === '' ? 0 : parseInt(e.target.value);
    if (!Number.isInteger(unbondingBlocks)) return;
    this.setState({ unbondingBlocks: Math.min(unbondingBlocks, this.state.unbondingBlocksMax) }, async () => await this.updateForecastReward());
  }

  async updateForecastReward() {
    const { schnoodleStaking, amountToStake, vestingBlocks, unbondingBlocks, blockNumber } = this.state;

    // eslint-disable-next-line
    if (amountToStake == 0 || vestingBlocks === 0 || unbondingBlocks === 0) {
      this.setState({ vestForecastReward: 0, apy: 0 });
      return;
    }

    const vestForecastReward = await newStakeForecastReward(blockNumber + vestingBlocks);
    const yearForecastReward = await newStakeForecastReward(await this.blockNumberAfterOneYear());
    const apy = this.calculateApy(amountToStake, yearForecastReward);
    this.setState({ vestForecastReward, apy });

    async function newStakeForecastReward(rewardBlock) {
      if (rewardBlock === 0) return 0;
      return await schnoodleStaking.methods.reward(amountToStake.toString(), vestingBlocks.toString(), unbondingBlocks, rewardBlock).call();
    }
  }

  blocksPerDuration(duration) {
    const { averageBlockTime } = this.state;
    return averageBlockTime === 0 ? 0 : Math.floor(Duration.fromObject(duration).as('seconds') / averageBlockTime);
  }

  blocksDurationText(blocks) {
    return 'Approximately ' + humanizeDuration(Duration.fromObject({ seconds: blocks * this.state.averageBlockTime }), { largest: 2, round: true });
  }

  blockNumberAfterOneYear() {
    const { blockNumber } = this.state;
    return blockNumber + this.blocksPerDuration({ years: 1 });
  }

  calculateApy(amount, reward) {
    return reward === '0' ? 0 : Math.floor(reward / amount * 100);
  }

  renderStakingSummaryTable(stakingSummary) {
    return (
      <table className='table table-striped w-full mb-6 md:mb-10 border-collapse border border-secondary' aria-labelledby="tabelLabel">
        <thead>
          <tr>
            <th class="hidden md:table-cell">Block Number</th>
            <th><span class="hidemd">Staked<br />Amount</span><span class="hidesm">Staked Amount</span></th>
            <th><span class="hidemd">Blocks<br />Pending</span><span class="hidesm">Blocks Pending</span></th>
            <th><span class="hidemd">Unbonding<br />Blocks</span><span class="hidesm">Unbonding Blocks</span></th>
            <th><span class="hidemd">Estimated<br />APY</span><span class="hidesm">Estimated APY</span></th>
            <th>Withdraw</th>
            <th><span class="hidemd">Claimable<br />Reward</span><span class="hidesm">Claimable Reward</span></th>
          </tr>
        </thead>
        <tbody>
          {stakingSummary.map((stakeReward, i) => {
            const amount = this.scaleDownUnits(stakeReward.stake.amount);
            const blocksPending = Math.max(0, parseInt(stakeReward.stake.blockNumber) + parseInt(stakeReward.stake.vestingBlocks) - this.state.blockNumber);
            return (
              <tr key={stakeReward.stake.blockNumber}>
                <td class="hidden md:table-cell">{stakeReward.stake.blockNumber}</td>
                <td>{amount.toLocaleString()}</td>
                <td title={this.blocksDurationText(blocksPending)}>{blocksPending}</td>
                <td title={this.blocksDurationText(stakeReward.stake.unbondingBlocks)}>{stakeReward.stake.unbondingBlocks}</td>
                <td>{stakeReward.apy} %</td>
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
                <td>{this.scaleDownUnits(stakeReward.reward).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  renderUnbondingSummaryTable(unbondingSummary) {
    return (
      <table className='table table-striped w-full mb-6 md:mb-10 border-collapse border border-secondary' aria-labelledby="tabelLabel">
        <thead>
          <tr>
            <th class="hidden md:table-cell">Amount</th>
            <th><span class="hidemd">Blocks<br />Pending</span><span class="hidesm">Blocks Pending</span></th>
            <th><span class="hidemd">Time<br />Remaining</span><span class="hidesm">Time Remaining</span></th>
          </tr>
        </thead>
        <tbody>
          {unbondingSummary.map((unbond, i) => {
            const amount = this.scaleDownUnits(unbond.amount);
            const blocksPending = parseInt(unbond.expiryBlock) - this.state.blockNumber;
            return blocksPending > 0 && (
              <tr key={unbond.expiryBlock}>
                <td>{amount.toLocaleString()}</td>
                <td>{blocksPending}</td>
                <td>{this.blocksDurationText(blocksPending)}</td>
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
    const stakeableAmount = this.scaleDownUnits(this.state.stakeableAmount);
    const amountToStake = this.scaleDownUnits(this.state.amountToStake);

    const token = 'SNOOD';
    const stakeTokens = `Stake ${token} tokens.`;
    const earnTokens = `Earn ${token} tokens.`;

    if (!this.state.web3) {
      return (
        <div class="overflow-hidden antialiased font-roboto mx-4">  
          <div class="h-noheader md:flex">
            <div class="flex items-center justify-center w-full">
              <div class="px-4">
              <img class="object-cover w-1/2 my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles">SCHNOODLE X</div>
                <div class="w-16 h-1 my-3 bg-secondary md:my-6"></div>
                <p class="text-4xl font-light leading-normal text-accent md:text-5xl loading">Loading<span>.</span><span>.</span><span>.</span></p>
                <div class="px-4 mt-4 fakebutton">&nbsp;</div>
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
                  <div class="stat-title">Block Number</div>
                  <div class="stat-value greenfade">{this.state.blockNumber}</div>
                  <div class="stat-desc">&nbsp;</div>
                </div>
                <div class="stat">
                  <div class="stat-title">Sell Quota</div>
                  <div class="stat-value greenfade">{this.scaleDownUnits(this.state.sellQuota.amount).toLocaleString()}</div>
                  <div class="stat-desc">{token} since {new Date(this.state.sellQuota.blockMetric * 1000).toLocaleString()}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">Staking Fund Balance</div>
                  <div class="stat-value greenfade">{this.scaleDownUnits(this.state.stakingFundBalance).toLocaleString()}</div>
                  <div class="stat-desc">{token}</div>
                </div>
              </div>

              <div class="stats topstats">
                <div class="stat">
                  <div class="stat-title">Operative Fee Rate</div>
                  <div class="stat-value greenfade">{this.state.operativeFeeRate / 10}</div>
                  <div class="stat-desc">%</div>
                </div>
                <div class="stat">
                  <div class="stat-title">Eleemosynary Donation Rate</div>
                  <div class="stat-value greenfade">{this.state.donationRate / 10}</div>
                  <div class="stat-desc">%</div>
                </div>
                <div class="stat">
                  <div class="stat-title">Staking Rate</div>
                  <div class="stat-value greenfade">{this.state.stakingRate / 10}</div>
                  <div class="stat-desc">%</div>
                </div>
              </div>

              <div class="card shadow-sm border-purple-500 border-4 rounded-2xl text-accent-content mt-5 mb-5 container-lg">
                <div class="card-body my-6 md:my-10 rounded-4xl">
                  <h2 class="card-title headingfont text-purple-500"><span class="purplefade">Your {token} Tokens</span></h2>
                   {this.state.reflectTrackerInfo.blockNumber > 0 && (
                    <div class="stats barkstats">
                      <div class="stat text-error">
                        <div class="stat-title font-extrabold">BARK Rewards</div>
                        <div class="stat-value text-accent">
                         {this.scaleDownUnits(this.state.reflectTrackerInfo.deltaBalance).toLocaleString()}
                          <input class="ml-4 max-h-6 xl:max-h-8" type="image" src="../../assets/img/svg/reset-button.svg" alt="Reset" onClick={this.resetReflectTracker} title="Reset" />
                        </div>
                        <div class="stat-desc">{token}<br /><span class="opacity-60 text-xs">since block {this.state.reflectTrackerInfo.blockNumber}</span></div>
                      </div>
                    </div>
                   )} 
                  <div class="shadow-sm bottomstats stats ">
                    <div class="stat border-t-0">
                      <div class="stat-title">Total Balance</div>
                      <div class="stat-value purplefade">{balance.toLocaleString()}</div>
                      <div class="stat-desc">{token}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-title">Staked Balance</div>
                      <div class="stat-value purplefade">{stakedBalance.toLocaleString()}</div>
                      <div class="stat-desc">{token}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-title">Stakeable Amount</div>
                      <div class="stat-value purplefade">{stakeableAmount.toLocaleString()}</div>
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
                              <input type="number" min="1" max={stakeableAmount} value={amountToStake || ''} onChange={this.updateAmountToStake} class="stakeinput" />
                              <button type="button" class="absolute top-0 right-0 rounded-l-none btn btn-accent opacity-80 bordered border-accent text-base-300 text-lg uppercase" onClick={this.stakeAll}>All</button>
                            </div>
                          </div>
                        </div>
                        <div class="mb-3 form-control">
                          <label class="label">
                            <span class="label-text">Vesting Blocks</span>
                          </label>
                          <input type="number" min="1" max={this.state.vestingBlocksMax} placeholder={'Max: ' + this.state.vestingBlocksMax} value={this.state.vestingBlocks || ''} onChange={this.updateVestingBlocks} class="stakeinput" />
                          <p class="approxLabel">{this.blocksDurationText(this.state.vestingBlocks)}</p>
                        </div>
                        <div class="mb-3 form-control">
                          <label class="label">
                            <span class="label-text">Unbonding Blocks</span>
                          </label>
                          <input type="number" min="1" max={this.state.unbondingBlocksMax} placeholder={'Max: ' + this.state.unbondingBlocksMax} value={this.state.unbondingBlocks || ''} onChange={this.updateUnbondingBlocks} class="stakeinput" />
                          <p class="approxLabel">{this.blocksDurationText(this.state.unbondingBlocks)}</p>
                        </div>
                        <div class="shadow-sm bottomstats stats ">
                          <div class="stat border-t-1 md:border-t-0 md:border-base-200">
                            <div class="stat-title">Vest Forecast Reward</div>
                            <div class="stat-value text-accent">{this.scaleDownUnits(this.state.vestForecastReward).toLocaleString()}</div>
                            <div class="stat-desc">{token}</div>
                          </div>
                          <div class="stat border-t-1 md:border-t-0 md:border-base-200">
                            <div class="stat-title">Estimated APY</div>
                            <div class="stat-value text-accent">{this.state.apy}</div>
                            <div class="stat-desc">%</div>
                          </div>
                        </div>
                        <div class="mb-3 form-control">
                          <button type="button" className='btn btn-accent mt-5 text-xl font-black' disabled={amountToStake < 1 || this.state.vestingBlocks < 1 || this.state.unbondingBlocks < 1 || amountToStake > stakeableAmount} onClick={this.addStake}>Stake</button>
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

              {this.state.unbondingSummary.length > 0 && this.state.unbondingSummary.some(u => parseInt(u.expiryBlock) - this.state.blockNumber > 0) && (
                <div class="staketable">
                  <h3 class="mb-5 headingfont staketitle mt-10">Unbonding</h3>
                  <div class="overflow-x-auto text-secondary my-5 ">
                    {this.renderUnbondingSummaryTable(this.state.unbondingSummary)}
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
