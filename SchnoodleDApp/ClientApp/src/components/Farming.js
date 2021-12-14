import React, { Component } from 'react';
import { resources } from '../resources';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV7 from "../contracts/SchnoodleV7.json";
import SchnoodleFarming from "../contracts/SchnoodleFarmingV1.json";
import getWeb3 from "../getWeb3";
import { initializeHelpers, scaleDownUnits, scaleUpUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks } from '../helpers';

// Third-party libraries
import { debounce, range } from 'lodash';
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import Plot from 'react-plotly.js';
import Loader from "react-loader-spinner";
const bigInt = require("big-integer");

export class Farming extends Component {
  static displayName = Farming.name;
  static vestiplotsCancellationToken;
  
  constructor(props) {
    super(props);

    this.state = {
      success: false,
      message: null,
      web3: null,
      schnoodle: null,
      schnoodleFarming: null,
      selectedAddress: null,
      getInfoIntervalId: 0,
      farmingFundBalance: 0,
      blockNumber: 0,
      operativeFeeRate: 0,
      donationRate: 0,
      sowRate: 0,
      sellQuota: { 'blockMetric': 0, 'amount': 0 },
      balance: 0,
      depositAmount: 0,
      vestingBlocks: 0,
      vestingBlocksMax: 0,
      unbondingBlocks: 0,
      unbondingBlocksMax: 0,
      vestimatedReward: 0,
      vestimatedApy: 0,
      vestiplotReward: [],
      vestiplotApy: [],
      vestiplotProgress: 0,
      lockedBalance: 0,
      unbondingBalance: 0,
      availableAmount: 0,
      farmingSummary: [],
      unbondingSummary: [],
      withdrawAmounts: [],
      openHelpModal: false,
      helpTitle: '',
      helpInfo: '',
      helpDetails: ''
    };

    this.addDeposit = this.addDeposit.bind(this);
    this.updateDepositAmount = this.updateDepositAmount.bind(this);
    this.maxDepositAmount = this.maxDepositAmount.bind(this);
    this.updateVestingBlocks = this.updateVestingBlocks.bind(this);
    this.maxVestingBlocks = this.maxVestingBlocks.bind(this);
    this.updateUnbondingBlocks = this.updateUnbondingBlocks.bind(this);
    this.maxUnbondingBlocks = this.maxUnbondingBlocks.bind(this);
    this.closeHelpModal = this.closeHelpModal.bind(this);

    this.updateVestimates = debounce(this.updateVestimates, 500);
    this.updateVestiplots = debounce(this.updateVestiplots, 2000);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const schnoodleDeployedNetwork = SchnoodleV1.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(SchnoodleV7.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleFarmingDeployedNetwork = SchnoodleFarming.networks[await web3.eth.net.getId()];
      const schnoodleFarming = new web3.eth.Contract(SchnoodleFarming.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
      await initializeHelpers(await schnoodle.methods.decimals().call());

      this.setState({ web3, schnoodle, schnoodleFarming, selectedAddress: web3.currentProvider.selectedAddress }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 10000);
        this.setState({ getInfoIntervalId });
      });
    
      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));
    } catch (err) {
      alert('Load error. Please check you are connected to the correct network in MetaMask.');
      console.error(err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.getInfoIntervalId);
    this.updateVestimates.cancel();
    this.updateVestiplots.cancel();
  }

  async getInfo() {
    const { web3, schnoodle, schnoodleFarming, selectedAddress } = this.state;

    const blockNumber = await web3.eth.getBlockNumber();

    this.setState({ blockNumber }, async () => {
      const operativeFeeRate = await schnoodle.methods.getOperativeFeeRate().call();
      const { 1: donationRate } = await schnoodle.methods.getEleemosynaryDetails().call();
      const sowRate = await schnoodle.methods.getSowRate().call();
      const sellQuota = await schnoodle.methods.getSellQuota().call();
      const farmingFundBalance = bigInt(await schnoodle.methods.balanceOf(await schnoodle.methods.getFarmingFund().call()).call());

      const balance = bigInt(await schnoodle.methods.balanceOf(selectedAddress).call());
      const lockedBalance = bigInt(await schnoodleFarming.methods.lockedBalanceOf(selectedAddress).call());
      const unbondingBalance = bigInt(await schnoodleFarming.methods.unbondingBalanceOf(selectedAddress).call());
      const availableAmount = balance.subtract(lockedBalance);
      const vestingBlocksMax = blocksPerDuration({ years: 1 });
      const unbondingBlocksMax = blocksPerDuration({ years: 1 });

      // Fetch the farming summary while also calculating the APY for each deposit
      const farmingSummary = await Promise.all([].concat(await schnoodleFarming.methods.getFarmingSummary(selectedAddress).call()).sort((a, b) => a.deposit.blockNumber > b.deposit.blockNumber ? 1 : -1).map(async (depositReward) => {
        const deposit = depositReward.deposit;
        const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
        const vestimatedApy = await calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(selectedAddress, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber)
        return { deposit: deposit, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
      }));

      const unbondingSummary = [].concat(await schnoodleFarming.methods.getUnbondingSummary(selectedAddress).call()).sort((a, b) => a.expiryBlock > b.expiryBlock ? 1 : -1);

      let withdrawAmounts = [];
      for (let i = 0; i < farmingSummary.length; i++) {
        const withdrawAmount = this.state.withdrawAmounts[i];
        withdrawAmounts[i] = this.state.withdrawAmounts[i] === undefined ? scaleDownUnits(farmingSummary[i].deposit.amount) : withdrawAmount;
      }

      this.setState({
        farmingFundBalance,
        operativeFeeRate,
        donationRate,
        sowRate,
        sellQuota,
        balance,
        vestingBlocksMax,
        unbondingBlocksMax,
        lockedBalance,
        unbondingBalance,
        availableAmount,
        farmingSummary,
        unbondingSummary,
        withdrawAmounts
      });
    });
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

  async addDeposit() {
    try {
      const { schnoodleFarming, selectedAddress, depositAmount, vestingBlocks, unbondingBlocks, availableAmount } = this.state;

      const depositAmountValue = this.preventDust(depositAmount, availableAmount);
      const response = await schnoodleFarming.methods.addDeposit(depositAmountValue.toString(), vestingBlocks, unbondingBlocks).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  async withdraw(i) {
    try {
      const { schnoodleFarming, selectedAddress, withdrawAmounts, farmingSummary } = this.state;

      const depositInfo = farmingSummary[i];
      const amountToWithdraw = this.preventDust(withdrawAmounts[i], depositInfo.deposit.amount);
      const response = await schnoodleFarming.methods.withdraw(depositInfo.deposit.id, amountToWithdraw.toString()).send({ from: selectedAddress });
      this.handleResponse(response);
    } catch (err) {
      await this.handleError(err);
    }
  }

  preventDust(userAmount, maxAmount) {
    return userAmount === scaleDownUnits(maxAmount) ? maxAmount : scaleUpUnits(userAmount);
  }

  updateWithdrawAmount(index, e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    const { withdrawAmounts } = this.state;
    withdrawAmounts[index] = Math.min(value, scaleDownUnits(this.state.farmingSummary[index].deposit.amount));
    this.setState({ withdrawAmounts });
  }

  async maxWithdraw(index) {
    const { withdrawAmounts } = this.state;
    withdrawAmounts[index] = scaleDownUnits(this.state.farmingSummary[index].deposit.amount);
    this.setState({ withdrawAmounts });
  }

  async updateDepositAmount(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setDepositAmount(value);
  }

  async maxDepositAmount() {
    this.setDepositAmount(scaleDownUnits(this.state.availableAmount));
  }

  async setDepositAmount(amount) {
    this.setState({ depositAmount: Math.min(Math.floor(amount), scaleDownUnits(this.state.availableAmount)) }, async () => {
      await this.updateVestimates();
      await this.updateVestiplots();
    });
  }

  async updateVestingBlocks(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setState({ vestingBlocks: Math.min(value, this.state.vestingBlocksMax) }, async () => await this.updateVestimates());
  }

  async addVestingBlocks(blocks) {
    const { vestingBlocks } = this.state;
    this.setState({ vestingBlocks: Math.min(vestingBlocks + blocks, this.state.vestingBlocksMax) }, async () => await this.updateVestimates());
  }

  async maxVestingBlocks() {
    this.setState({ vestingBlocks: this.state.vestingBlocksMax }, async () => await this.updateVestimates());
  }

  async updateUnbondingBlocks(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setState({ unbondingBlocks: Math.min(value, this.state.unbondingBlocksMax) }, async () => await this.updateVestimates());
  }

  async addUnbondingBlocks(blocks) {
    const { unbondingBlocks } = this.state;
    this.setState({ unbondingBlocks: Math.min(unbondingBlocks + blocks, this.state.unbondingBlocksMax) }, async () => await this.updateVestimates());
  }

  async maxUnbondingBlocks() {
    this.setState({ unbondingBlocks: this.state.unbondingBlocksMax }, async () => await this.updateVestimates());
  }

  async updateVestimates() {
    const { depositAmount, vestingBlocks, unbondingBlocks } = this.state;
    const [vestimatedReward, vestimatedApy] = await this.getVestimates(scaleUpUnits(depositAmount), vestingBlocks, unbondingBlocks);
    this.setState({ vestimatedReward, vestimatedApy });
  }

  async updateVestiplots() {
    const { depositAmount, vestingBlocksMax, unbondingBlocksMax } = this.state;

    const token = this.vestiplotsCancellationToken = Symbol();
    const vestingBlocksList = range(10, vestingBlocksMax, vestingBlocksMax / 10);
    const unbondingBlocksList = range(10, unbondingBlocksMax, unbondingBlocksMax / 10);
    const rewardX = [];
    const rewardY = [];
    const rewardZ = [];
    const apyX = [];
    const apyY = [];
    const apyZ = [];

    let vestiplotProgress = 0;

    if (depositAmount > 0) {
      for (const vestingBlocksItem of vestingBlocksList) {
        for (const unbondingBlocksItem of unbondingBlocksList) {
          if (token !== this.vestiplotsCancellationToken) return;

          const [vestimatedReward, vestimatedApy] = await this.getVestimates(depositAmount, vestingBlocksItem, unbondingBlocksItem);

          rewardX.push(vestingBlocksItem);
          rewardY.push(unbondingBlocksItem);
          rewardZ.push(vestimatedReward);
          apyX.push(vestingBlocksItem);
          apyY.push(unbondingBlocksItem);
          apyZ.push(vestimatedApy);

          this.setState({ vestiplotProgress: ++vestiplotProgress });
        }
      }
    }

    const vestiplotReward = [
      {
        type: 'mesh3d',
        opacity: 0.5,
        color: 'rgb(200,100,200)',
        x: rewardX,
        y: rewardY,
        z: rewardZ
      }
    ];

    const vestiplotApy = [
      {
        type: 'mesh3d',
        opacity: 0.5,
        color: 'rgb(033,255,100)',
        x: apyX,
        y: apyY,
        z: apyZ
      }
    ];

    this.setState({ vestiplotReward, vestiplotApy });
  }

  async getVestimates(amount, vestingBlocks, unbondingBlocks) {
    const { schnoodleFarming, blockNumber } = this.state;

    if (bigInt(amount).value === 0n || vestingBlocks === 0 || unbondingBlocks === 0) {
      return [0, 0];
    }

    const vestingBlocksFloored = Math.floor(vestingBlocks);
    const vestimatedReward = await schnoodleFarming.methods.getReward(amount.toString(), vestingBlocksFloored, Math.floor(unbondingBlocks), blockNumber + vestingBlocksFloored).call();
    const vestimatedApy = await calculateApy(amount, vestimatedReward, vestingBlocks);

    return [vestimatedReward, vestimatedApy];
  }

  openHelpModal(content) {
    this.setState({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS, openHelpModal: true })
  }

  closeHelpModal() {
    this.setState({ openHelpModal: false })
  }

  renderFarmingSummaryTable(farmingSummary) {
    const space = ' ';
    const blockNumberTitleParts = resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE.split(space);
    const depositAmountTitleParts = resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE.split(space);
    const pendingBlocksTitleParts = resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE.split(space);
    const unbondingBlocksTitleParts = resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE.split(space);
    const vestimatedApyTitleParts = resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE.split(space);
    const currentRewardTitleParts = resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE.split(space);

    return (
      <div role="table" aria-label="Farming Summary" class="border-secondary border-4 rounded-2xl text-accent-content">
        <div role="rowgroup" class="columnheader-group">
          <div role="row">
            <span role="columnheader" class="narrower">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {pendingBlocksTitleParts[0]}<br />{pendingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.PENDING_BLOCKS)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {unbondingBlocksTitleParts[0]}<br />{unbondingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.UNBONDING_BLOCKS)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {vestimatedApyTitleParts[0]}<br />{vestimatedApyTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.VESTIMATED_APY)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {resources.FARMING_SUMMARY.MULTIPLIER.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.MULTIPLIER)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="wide">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="wider">
              {resources.FARMING_SUMMARY.WITHDRAW.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.WITHDRAW)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="text-secondary">
          {farmingSummary.map((depositInfo, i) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = getPendingBlocks(depositInfo.deposit, this.state.blockNumber);
            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} class="border-l-0 narrower">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} class="narrow" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} title={blocksDurationText(depositInfo.deposit.unbondingBlocks)}>{depositInfo.deposit.unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} class="narrow" >{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} class="narrow" >{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"} class="wide">{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
                <span role="cell" class="wider">
                  <form>
                    <fieldset disabled={pendingBlocks > 0}>
                      <div class="relative">
                        <div class="flex">
                          <input type="number" min="1" max={amount} value={this.state.withdrawAmounts[i] || ''} onChange={this.updateWithdrawAmount.bind(this, i)} class="withdrawinput" />
                          <button type="button" onClick={this.maxWithdraw.bind(this, i)} class="maxwithdraw">Max</button>
                          <button type="button" class="text-base xl:text-xl btn btn-secondary text-base-300 px-2 lg:px-3 xl:px-8" disabled={this.state.withdrawAmounts[i] < 1 || this.state.withdrawAmounts[i] > amount} onClick={this.withdraw.bind(this, i)}><span class="">Withdraw</span></button>
                        </div>
                      </div>
                    </fieldset>
                  </form>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  renderUnbondingSummaryTable(unbondingSummary) {
    return (
      <div role="table" aria-label="Unbonding Summary" class="border-secondary border-4 rounded-2xl text-accent-content">
        <div role="rowgroup" class="columnheader-group">
          <div role="row">
            <span role="columnheader" class="">
              {resources.UNBONDING_SUMMARY.AMOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.AMOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="">
              {resources.UNBONDING_SUMMARY.PENDING_BLOCKS.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.PENDING_BLOCKS)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {resources.UNBONDING_SUMMARY.TIME_REMAINING.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.TIME_REMAINING)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="text-secondary">
          {unbondingSummary.map((unbond) => {
            const amount = scaleDownUnits(unbond.amount);
            const pendingBlocks = parseInt(unbond.expiryBlock) - this.state.blockNumber;
            return pendingBlocks > 0 && (
              <div role="row" key={unbond.expiryBlock}>
                <span role="cell" data-header="Amount:">{amount.toLocaleString()}</span>
                <span role="cell" data-header="Pending Blocks:">{pendingBlocks}</span>
                <span role="cell" data-header="Time Remaining:">{blocksDurationText(pendingBlocks)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  render() {
    const balance = scaleDownUnits(this.state.balance);
    const lockedBalance = scaleDownUnits(this.state.lockedBalance);
    const unbondingBalance = scaleDownUnits(this.state.unbondingBalance);
    const availableAmount = scaleDownUnits(this.state.availableAmount);

    const token = 'SNOOD';
    const subtitle1 = 'Advanced yield farming.';
    const subtitle2 = 'But on the Moon.';

    if (!this.state.web3) {
      return (
        <div class="overflow-hidden antialiased font-roboto mx-4">
          <div class="h-noheader md:flex">
            <div class="flex items-center justify-center w-full">
              <div class="px-4">
                <img class="object-cover w-1/2 my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles uppercase">{resources.MOON_FARMING}</div>
                <div class="w-16 h-1 my-3 bg-secondary md:my-6" />
                <p class="text-4xl font-light leading-normal text-accent md:text-5xl loading">{resources.LOADING}<span>.</span><span>.</span><span>.</span></p>
                <div class="px-4 mt-4 fakebutton">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="farming w-100">
        <div class="m-auto px-4 max-w-screen-2xl">
          <div class="h-noheader overflow-hidden bg-neutral-focus mx-2 md:m-auto font-roboto">
            <div class="text-center px-1 md:px-4">
              <div class="text-base-200 w-full">
                <h1 class="mt-10 mb-2 maintitles leading-tight text-center md:text-left uppercase">{resources.MOON_FARMING}</h1>
                <p class="my-2 text-2xl md:text-3xl leading-tight titlefont w-2/3 md:w-full m-auto md:mx-0 textfade from-green-400 to-purple-500">
                  <span class="block md:hidden text-center">{subtitle1}<br />{subtitle2}</span>
                  <span class="hidden md:block text-left">{subtitle1} {subtitle2}</span>
                </p>
                <div class="stats topstats">
                  <div class="stat">
                    <div class="stat-title">
                      {resources.BLOCK_NUMBER.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.BLOCK_NUMBER)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{this.state.blockNumber}</div>
                    <div class="stat-desc">&nbsp;</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">
                      {resources.SELL_QUOTA.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.SELL_QUOTA)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{scaleDownUnits(this.state.sellQuota.amount).toLocaleString()}</div>
                    <div class="stat-desc">{token} since {new Date(this.state.sellQuota.blockMetric * 1000).toLocaleString()}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">
                      {resources.FARMING_FUND_BALANCE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_FUND_BALANCE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{scaleDownUnits(this.state.farmingFundBalance).toLocaleString()}</div>
                    <div class="stat-desc">{token}</div>
                  </div>
                </div>

                <div class="stats topstats">
                  <div class="stat">
                    <div class="stat-title">
                      {resources.OPERATIVE_FEE_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.OPERATIVE_FEE_RATE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{this.state.operativeFeeRate / 10}</div>
                    <div class="stat-desc">%</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">
                      {resources.ELEEMOSYNARY_DONATION_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.ELEEMOSYNARY_DONATION_RATE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{this.state.donationRate / 10}</div>
                    <div class="stat-desc">%</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">
                      {resources.FARMING_FUND_SOW_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_FUND_SOW_RATE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                    </div>
                    <div class="stat-value greenfade">{this.state.sowRate / 10}</div>
                    <div class="stat-desc">%</div>
                  </div>
                </div>

                <div class="card shadow-sm border-purple-500 border-4 rounded-2xl text-accent-content mt-5 mb-5 container-lg">
                  <div class="card-body my-6 md:my-10 rounded-4xl">
                    <h2 class="card-title headingfont text-purple-500"><span class="purplefade">Your {token} Tokens</span></h2>
                    <div class="shadow-sm bottomstats stats">
                      <div class="stat border-t-0">
                        <div class="stat-title">
                          {resources.TOTAL_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.TOTAL_BALANCE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                        </div>
                        <div class="stat-value purplefade">{balance.toLocaleString()}</div>
                        <div class="stat-desc">{token}</div>
                      </div>
                      <div class="stat">
                        <div class="stat-title">
                          {resources.LOCKED_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.LOCKED_BALANCE)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                        </div>
                        <div class="stat-value purplefade">{lockedBalance.toLocaleString()}</div>
                        <div class="stat-desc">{token}{unbondingBalance > 0 && (<span class="opacity-60 text-xs"><br />{unbondingBalance.toLocaleString()} unbonding</span>)}</div>
                      </div>
                      <div class="stat">
                        <div class="stat-title">
                          {resources.AVAILABLE_AMOUNT.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.AVAILABLE_AMOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                        </div>
                        <div class="stat-value purplefade">{availableAmount.toLocaleString()}</div>
                        <div class="stat-desc">{token}</div>
                      </div>
                    </div>

                    <div class="divider mt-10">
                      <h3 class="sectiontitle text-2xl md:text-3xl leading-tight">{resources.ADD_DEPOSIT}</h3>
                    </div>

                    <div class="card-actions text-center mx-auto w-full">
                      <form class="justify-center fullhalfwidth mx-auto mt-5">
                        <fieldset disabled={availableAmount === 0}>
                          <div class="form-control">
                            <div>
                              <label class="label">
                                <span class="label-text">
                                  {resources.DEPOSIT_AMOUNT.TITLE}
                                  <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.DEPOSIT_AMOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                                </span>
                              </label>
                              <div class="relative flex">
                                <input type="number" min="1" max={availableAmount} placeholder={'Max: ' + availableAmount} value={this.state.depositAmount || ''} onChange={this.updateDepositAmount} class="depositinput" />
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount / 3)}>25%</button>
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount / 2)}>50%</button>
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount * 3 / 4)}>75%</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount / 3)}>&frac14;</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount / 2)}>&frac12;</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount * 3 / 4)}>&frac34;</button>
                                <button type="button" class="maxbuttons" onClick={this.maxDepositAmount}>Max</button>
                              </div>
                            </div>
                          </div>
                          <div class="mb-3 form-control nobutton">
                            <label class="label">
                              <span class="label-text">
                                {resources.VESTING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTING_BLOCKS)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                              </span>
                            </label>
                            <div class="mb-3 flex">
                              <input type="number" min="1" max={this.state.vestingBlocksMax} placeholder={'Max: ' + this.state.vestingBlocksMax} value={this.state.vestingBlocks || ''} onChange={this.updateVestingBlocks} class="depositinput w-full" />
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ weeks: 1 }))}>Week</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ months: 1 }))}>Month</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ days: 1 }))}>D</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ weeks: 1 }))}>W</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ months: 1 }))}>M</button>
                              <button type="button" class="maxbuttons" onClick={this.maxVestingBlocks}>Max</button>
                            </div>
                            <p class="approxLabel">{blocksDurationText(this.state.vestingBlocks)}</p>
                          </div>
                          <div class="mb-3 form-control nobutton">
                            <label class="label">
                              <span class="label-text">
                                {resources.UNBONDING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_BLOCKS)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                              </span>
                            </label>
                            <div class="mb-3 flex">
                              <input type="number" min="1" max={this.state.unbondingBlocksMax} placeholder={'Max: ' + this.state.unbondingBlocksMax} value={this.state.unbondingBlocks || ''} onChange={this.updateUnbondingBlocks} class="depositinput" />
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ weeks: 1 }))}>Week</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ months: 1 }))}>Month</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ days: 1 }))}>D</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ weeks: 1 }))}>W</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ months: 1 }))}>M</button>
                              <button type="button" class="maxbuttons" onClick={this.maxUnbondingBlocks}>Max</button>
                            </div>
                            <p class="approxLabel">{blocksDurationText(this.state.unbondingBlocks)}</p>
                          </div>
                          <div class="shadow-sm bottomstats stats">
                            <div class="stat border-t-1 md:border-t-0 md:border-base-200">
                              <div class="stat-title">
                                {resources.VESTIMATED_REWARD.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTIMATED_REWARD)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                              </div>
                              <div class="stat-value text-accent">{scaleDownUnits(this.state.vestimatedReward).toLocaleString()}</div>
                              <div class="stat-desc">{token}</div>
                            </div>
                            <div class="stat border-t-1 md:border-t-0 md:border-base-200">
                              <div class="stat-title">
                                {resources.VESTIMATED_APY.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTIMATED_APY)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
                              </div>
                              <div class="stat-value text-accent">{this.state.vestimatedApy}</div>
                              <div class="stat-desc">%</div>
                            </div>
                          </div>
                          <div class="mb-3 form-control">
                            <button type="button" className='btn btn-accent mt-5 text-xl font-black hover:bg-yellow-200' disabled={this.state.depositAmount < 1 || this.state.vestingBlocks < 1 || this.state.unbondingBlocks < 1 || this.state.depositAmount > availableAmount} onClick={this.addDeposit}>Deposit</button>
                          </div>
                        </fieldset>
                      </form>
                    </div>

                    {this.state.vestiplotProgress > 0 && this.state.vestiplotProgress < 100 && (
                      <div>
                        <div class="justify-center flex">
                          <Loader type="Puff" color="#00BFFF" />
                        </div>
                        <br />
                        <p class="approxLabel">{this.state.vestiplotProgress}%</p>
                      </div>
                    )}

                    <span>
                      {this.state.vestiplotReward.length > 0 && (
                        <Plot
                          data={this.state.vestiplotReward}
                          layout={{
                            scene: {
                              xaxis: { title: resources.VESTING_BLOCKS.TITLE },
                              yaxis: { title: resources.UNBONDING_BLOCKS.TITLE },
                              zaxis: { title: resources.VESTIMATED_REWARD.TITLE },
                            },
                            margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)'
                          }}
                        />
                      )}

                      {this.state.vestiplotApy.length > 0 && (
                        <Plot
                          data={this.state.vestiplotApy}
                          layout={{
                            scene: {
                              xaxis: { title: resources.VESTING_BLOCKS.TITLE },
                              yaxis: { title: resources.UNBONDING_BLOCKS.TITLE },
                              zaxis: { title: resources.VESTIMATED_APY.TITLE },
                            },
                            margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)'
                          }}
                        />
                      )}
                    </span>
                  </div>
                </div>

                {this.state.farmingSummary.length > 0 && (
                  <div class="summarytable">
                    <h3 class="mb-5 headingfont sectiontitle mt-10">{resources.FARMING_SUMMARY.TITLE}</h3>
                    <div class="overflow-x-auto text-secondary my-5">
                      {this.renderFarmingSummaryTable(this.state.farmingSummary)}
                    </div>
                  </div>
                )}

                {this.state.unbondingSummary.length > 0 && this.state.unbondingSummary.some(u => parseInt(u.expiryBlock) - this.state.blockNumber > 0) && (
                  <div class="summarytable">
                    <h3 class="mb-5 headingfont sectiontitle mt-10">{resources.UNBONDING_SUMMARY.TITLE}</h3>
                    <div class="overflow-x-auto text-secondary my-5">
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
      
          <div>
            <Modal open={this.state.openHelpModal} onClose={this.closeHelpModal} center classNames={{ overlay: 'customOverlay', modal: 'customModal' }}>
              <h1>{this.state.helpTitle}</h1>
              <p>{this.state.helpInfo}</p>
              <br />
              <p>{this.state.helpDetails}</p>
            </Modal>
          </div>
        </div>
      </div>
    );
  }
}