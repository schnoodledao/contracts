import React, { Component } from 'react';
import { resources } from '../resources';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV8 from "../contracts/SchnoodleV8.json";
import SchnoodleFarmingV1 from "../contracts/SchnoodleFarmingV1.json";
import SchnoodleFarmingV2 from "../contracts/SchnoodleFarmingV2.json";
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
      vestingBlocksFactor: 0,
      factoredVestingBlocks: 0,
      factoredVestingBlocksMax: 0,
      unbondingBlocksFactor: 0,
      factoredUnbondingBlocks: 0,
      factoredUnbondingBlocksMax: 0,
      vestimatedReward: 0,
      vestimatedApy: 0,
      vestiplotReward: [],
      vestiplotApy: [],
      vestiplotProgress: 0,
      optimumVestingBlocks: 0,
      optimumUnbondingBlocks: 0,
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
    this.maximiseApy = this.maximiseApy.bind(this);
    this.closeHelpModal = this.closeHelpModal.bind(this);

    this.updateVestimates = debounce(this.updateVestimates, 500);
    this.updateVestiplots = debounce(this.updateVestiplots, 2000);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const schnoodleDeployedNetwork = SchnoodleV1.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(SchnoodleV8.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleFarmingDeployedNetwork = SchnoodleFarmingV1.networks[await web3.eth.net.getId()];
      const schnoodleFarming = new web3.eth.Contract(SchnoodleFarmingV2.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
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
      const vestingBlocksFactor = await schnoodleFarming.methods.getVestingBlocksFactor().call() / 1000;
      const unbondingBlocksFactor = await schnoodleFarming.methods.getUnbondingBlocksFactor().call() / 1000;
      const factoredVestingBlocksMax = Math.floor(blocksPerDuration({ years: 1 }) * vestingBlocksFactor);
      const factoredUnbondingBlocksMax = Math.floor(await schnoodleFarming.methods.getMaxUnbondingBlocks().call() * unbondingBlocksFactor);

      // Fetch the farming summary while also calculating the APY for each deposit
      const farmingSummary = await Promise.all([].concat(await schnoodleFarming.methods.getFarmingSummary(selectedAddress).call()).sort((a, b) => a.deposit.blockNumber > b.deposit.blockNumber ? 1 : -1).map(async (depositReward) => {
        const deposit = depositReward.deposit;
        const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
        const vestimatedApy = await calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(selectedAddress, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber);
        const created = new Date((await web3.eth.getBlock(deposit.blockNumber)).timestamp * 1000);
        return { deposit: deposit, created: created, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
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
        vestingBlocksFactor,
        factoredVestingBlocksMax,
        unbondingBlocksFactor,
        factoredUnbondingBlocksMax,
        lockedBalance,
        unbondingBalance,
        availableAmount,
        farmingSummary,
        unbondingSummary,
        withdrawAmounts
      });
    });
  }

  //#region Error handling

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

  //#endregion

  //#region Deposit functions

  async addDeposit() {
    try {
      const { schnoodleFarming, selectedAddress, depositAmount, availableAmount } = this.state;

      const depositAmountValue = this.preventDust(depositAmount, availableAmount);
      const response = await schnoodleFarming.methods.addDeposit(depositAmountValue.toString(), this.vestingBlocks(), this.unbondingBlocks()).send({ from: selectedAddress });
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

  //#endregion

  //#region Withdraw amount functions

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

  //#endregion

  //#region Deposit amount functions

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

  //#endregion

  //#region Vesting blocks functions

  vestingBlocks() {
    const { factoredVestingBlocks, vestingBlocksFactor } = this.state;
    return factoredVestingBlocks / vestingBlocksFactor;
  }

  async updateVestingBlocks(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setState({ factoredVestingBlocks: Math.min(value, this.state.factoredVestingBlocksMax) }, async () => await this.updateVestimates());
  }

  async addVestingBlocks(blocks) {
    const { factoredVestingBlocks, factoredVestingBlocksMax } = this.state;
    this.setState({ factoredVestingBlocks: Math.min(factoredVestingBlocks + blocks, factoredVestingBlocksMax) }, async () => await this.updateVestimates());
  }

  async maxVestingBlocks() {
    this.setState({ factoredVestingBlocks: this.state.factoredVestingBlocksMax }, async () => await this.updateVestimates());
  }

  //#endregion

  //#region Unbonding blocks functions

  unbondingBlocks() {
    const { factoredUnbondingBlocks, unbondingBlocksFactor } = this.state;
    return factoredUnbondingBlocks / unbondingBlocksFactor;
  }

  async updateUnbondingBlocks(e) {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    this.setState({ factoredUnbondingBlocks: Math.min(value, this.state.factoredUnbondingBlocksMax) }, async () => await this.updateVestimates());
  }

  async addUnbondingBlocks(blocks) {
    const { factoredUnbondingBlocks, factoredUnbondingBlocksMax } = this.state;
    this.setState({ factoredUnbondingBlocks: Math.min(factoredUnbondingBlocks + blocks, factoredUnbondingBlocksMax) }, async () => await this.updateVestimates());
  }

  async maxUnbondingBlocks() {
    this.setState({ factoredUnbondingBlocks: this.state.factoredUnbondingBlocksMax }, async () => await this.updateVestimates());
  }

  //#endregion

  //#region Vestimates / Vestiplots

  async updateVestimates() {
    const [vestimatedReward, vestimatedApy] = await this.getVestimates(this.state.depositAmount, this.vestingBlocks(), this.unbondingBlocks());
    this.setState({ vestimatedReward, vestimatedApy });
  }

  async updateVestiplots() {
    const { depositAmount, factoredVestingBlocksMax, factoredUnbondingBlocksMax, vestingBlocksFactor, unbondingBlocksFactor } = this.state;

    const token = this.vestiplotsCancellationToken = Symbol();
    const vestingBlocksList = range(10, factoredVestingBlocksMax, Math.ceil(factoredVestingBlocksMax / 10));
    const unbondingBlocksList = range(10, factoredUnbondingBlocksMax, Math.ceil(factoredUnbondingBlocksMax / 10));
    const rewardX = [];
    const rewardY = [];
    const rewardZ = [];
    const apyX = [];
    const apyY = [];
    const apyZ = [];

    let optimumVestingBlocks = 0;
    let optimumUnbondingBlocks = 0;
    this.setState({ optimumVestingBlocks, optimumUnbondingBlocks });

    if (depositAmount > 0) {
      let maxVestimatedApy = 0;
      let steps = vestingBlocksList.length * unbondingBlocksList.length;
      let vestiplotProgress = 0;

      for (const vestingBlocksItem of vestingBlocksList) {
        for (const unbondingBlocksItem of unbondingBlocksList) {
          if (token !== this.vestiplotsCancellationToken) return;

          const [vestimatedReward, vestimatedApy] = await this.getVestimates(depositAmount, vestingBlocksItem / vestingBlocksFactor, unbondingBlocksItem / unbondingBlocksFactor);

          rewardX.push(vestingBlocksItem);
          rewardY.push(unbondingBlocksItem);
          rewardZ.push(vestimatedReward);
          apyX.push(vestingBlocksItem);
          apyY.push(unbondingBlocksItem);
          apyZ.push(vestimatedApy);

          if (vestimatedApy > maxVestimatedApy) {
            maxVestimatedApy = vestimatedApy;
            optimumVestingBlocks = vestingBlocksItem;
            optimumUnbondingBlocks = unbondingBlocksItem;
          }

          this.setState({ vestiplotProgress: Math.floor(100 * ++vestiplotProgress / steps) });
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

    this.setState({ vestiplotReward, vestiplotApy, optimumVestingBlocks, optimumUnbondingBlocks });
  }

  async maximiseApy() {
    this.setState({ factoredVestingBlocks: this.state.optimumVestingBlocks, factoredUnbondingBlocks: this.state.optimumUnbondingBlocks }, async () => await this.updateVestimates());
  }

  async getVestimates(amount, vestingBlocks, unbondingBlocks) {
    const { schnoodleFarming, blockNumber } = this.state;

    if (amount === 0 || vestingBlocks === 0 || unbondingBlocks === 0) {
      return [0, 0];
    }

    const vestimatedReward = scaleDownUnits(await schnoodleFarming.methods.getReward(scaleUpUnits(amount).toString(), vestingBlocks, unbondingBlocks, blockNumber + vestingBlocks).call());
    const vestimatedApy = await calculateApy(amount, vestimatedReward, vestingBlocks);

    return [vestimatedReward, vestimatedApy];
  }

  //#endregion

  //#region Help functions

  openHelpModal(content) {
    this.setState({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS, openHelpModal: true })
  }

  closeHelpModal() {
    this.setState({ openHelpModal: false })
  }

  //#endregion

  //#region Rendering

  renderFarmingSummaryTable(farmingSummary) {
    const space = ' ';
    const blockNumberTitleParts = resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE.split(space);
    const depositAmountTitleParts = resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE.split(space);
    const pendingBlocksTitleParts = resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE.split(space);
    const unbondingBlocksTitleParts = resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE.split(space);
    const vestimatedApyTitleParts = resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE.split(space);
    const currentRewardTitleParts = resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE.split(space);

    return (
      <div role="table" aria-label={resources.FARMING_SUMMARY.TITLE} class="tw-border-secondary tw-border-4 tw-rounded-2xl tw-text-accent-content">
        <div role="rowgroup" class="columnheader-group">
          <div role="row">
            <span role="columnheader" class="narrower">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrower">
              {resources.FARMING_SUMMARY.CREATED.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CREATED)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrower">
              {pendingBlocksTitleParts[0]}<br />{pendingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.PENDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrower">
              {unbondingBlocksTitleParts[0]}<br />{unbondingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.UNBONDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrower">
              {vestimatedApyTitleParts[0]}<br />{vestimatedApyTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.VESTIMATED_APY)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {resources.FARMING_SUMMARY.MULTIPLIER.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.MULTIPLIER)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="wider">
              {resources.FARMING_SUMMARY.WITHDRAW.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.WITHDRAW)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="tw-text-secondary">
          {farmingSummary.map((depositInfo, i) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = getPendingBlocks(Math.floor(depositInfo.deposit.vestingBlocks * this.state.vestingBlocksFactor), depositInfo.deposit.blockNumber, this.state.blockNumber);
            const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * this.state.unbondingBlocksFactor);

            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} class="tw-border-l-0 narrower">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ":"}  class="narrower" title={depositInfo.created.toLocaleTimeString()}>{depositInfo.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} class="narrower" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} class="narrower" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} class="narrower" >{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} class="narrow" >{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"}>{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
                <span role="cell" class="wider">
                  <form>
                    <fieldset disabled={pendingBlocks > 0}>
                      <div class="tw-relative">
                        <div class="tw-flex">
                          <input type="number" min="1" max={amount} value={this.state.withdrawAmounts[i] || ''} onChange={this.updateWithdrawAmount.bind(this, i)} class="withdrawinput" />
                          <button type="button" onClick={this.maxWithdraw.bind(this, i)} class="maxwithdraw">Max</button>
                          <button type="button" class="tw-text-base xl:tw-text-xl tw-btn tw-btn-secondary tw-text-base-300 tw-px-2 lg:tw-px-3 xl:tw-px-2" disabled={this.state.withdrawAmounts[i] < 1 || this.state.withdrawAmounts[i] > amount} onClick={this.withdraw.bind(this, i)}><span class="">Withdraw</span></button>
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
      <div role="table" aria-label={resources.UNBONDING_SUMMARY.TITLE} class="border-secondary border-4 rounded-2xl text-accent-content">
        <div role="rowgroup" class="columnheader-group">
          <div role="row">
            <span role="columnheader" class="">
              {resources.UNBONDING_SUMMARY.AMOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.AMOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="">
              {resources.UNBONDING_SUMMARY.PENDING_BLOCKS.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.PENDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {resources.UNBONDING_SUMMARY.TIME_REMAINING.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_SUMMARY.TIME_REMAINING)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="tw-text-secondary">
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
        <div class="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
          <div class="h-noheader md:tw-flex">
            <div class="tw-flex tw-items-center tw-justify-center tw-w-full">
              <div class="tw-px-4">
                <img class="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles tw-uppercase">{resources.MOON_FARMING}</div>
                <div class="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
                <p class="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{resources.LOADING}<span>.</span><span>.</span><span>.</span></p>
                <div class="tw-px-4 tw-mt-4 fakebutton">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="farming tw-w-100">
        <div class="tw-m-auto tw-px-4 tw-max-w-screen-2xl">
          <div class="h-noheader tw-overflow-hidden tw-bg-neutral-focus tw-mx-2 md:tw-m-auto tw-font-roboto">
            <div class="tw-text-center tw-px-1 md:tw-px-4">
              <div class="tw-text-base-200 tw-w-full">
                <h1 class="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.MOON_FARMING}</h1>
                <p class="tw-my-2 tw-text-2xl md:tw-text-3xl tw-leading-tight titlefont tw-w-2/3 md:tw-w-full tw-m-auto md:tw-mx-0 textfade tw-from-green-400 tw-to-purple-500">
                  <span class="tw-block md:tw-hidden tw-text-center">{subtitle1}<br />{subtitle2}</span>
                  <span class="tw-hidden md:tw-block tw-text-left">{subtitle1} {subtitle2}</span>
                </p>
                <div class="tw-stats stats topstats">
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.BLOCK_NUMBER.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.BLOCK_NUMBER)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{this.state.blockNumber}</div>
                    <div class="tw-stat-desc">&nbsp;</div>
                  </div>
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.SELL_QUOTA.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.SELL_QUOTA)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{scaleDownUnits(this.state.sellQuota.amount).toLocaleString()}</div>
                    <div class="tw-stat-desc">{token} since {new Date(this.state.sellQuota.blockMetric * 1000).toLocaleString()}</div>
                  </div>
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.FARMING_FUND_BALANCE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_FUND_BALANCE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{scaleDownUnits(this.state.farmingFundBalance).toLocaleString()}</div>
                    <div class="tw-stat-desc">{token}</div>
                  </div>
                </div>

                <div class="tw-stats stats topstats">
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.OPERATIVE_FEE_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.OPERATIVE_FEE_RATE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{this.state.operativeFeeRate / 10}</div>
                    <div class="tw-stat-desc">%</div>
                  </div>
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.ELEEMOSYNARY_DONATION_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.ELEEMOSYNARY_DONATION_RATE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{this.state.donationRate / 10}</div>
                    <div class="tw-stat-desc">%</div>
                  </div>
                  <div class="tw-stat">
                    <div class="tw-stat-title">
                      {resources.FARMING_FUND_SOW_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_FUND_SOW_RATE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div class="tw-stat-value greenfade">{this.state.sowRate / 10}</div>
                    <div class="tw-stat-desc">%</div>
                  </div>
                </div>

                <div class="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
                  <div class="tw-card-body tw-my-6 md:tw-my-10 tw-rounded-4xl">
                    <h2 class="tw-card-title headingfont tw-text-purple-500"><span class="purplefade">Your {token} Tokens</span></h2>
                    <div class="tw-shadow-sm bottomstats tw-stats stats">
                      <div class="tw-stat tw-border-t-0">
                        <div class="tw-stat-title">
                          {resources.TOTAL_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.TOTAL_BALANCE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div class="tw-stat-value purplefade">{balance.toLocaleString()}</div>
                        <div class="tw-stat-desc">{token}</div>
                      </div>
                      <div class="tw-stat">
                        <div class="tw-stat-title">
                          {resources.LOCKED_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.LOCKED_BALANCE)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div class="tw-stat-value purplefade">{lockedBalance.toLocaleString()}</div>
                        <div class="tw-stat-desc">{token}{unbondingBalance > 0 && (<span class="opacity-60 text-xs"><br />{unbondingBalance.toLocaleString()} unbonding</span>)}</div>
                      </div>
                      <div class="tw-stat">
                        <div class="tw-stat-title">
                          {resources.AVAILABLE_AMOUNT.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.AVAILABLE_AMOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div class="tw-stat-value purplefade">{availableAmount.toLocaleString()}</div>
                        <div class="tw-stat-desc">{token}</div>
                      </div>
                    </div>

                    <div class="tw-divider tw-mt-10">
                      <h3 class="sectiontitle tw-text-2xl md:tw-text-3xl tw-leading-tight">{resources.ADD_DEPOSIT}</h3>
                    </div>

                    <div class="tw-card-actions tw-text-center tw-mx-auto tw-w-full">
                      <form class="tw-justify-center fullhalfwidth tw-mx-auto tw-mt-5">
                        <fieldset disabled={availableAmount === 0}>
                          <div class="tw-form-control">
                            <div>
                              <label class="tw-label">
                                <span class="tw-label-text">
                                  {resources.DEPOSIT_AMOUNT.TITLE}
                                  <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.DEPOSIT_AMOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                                </span>
                              </label>
                              <div class="tw-relative tw-flex">
                                <input type="number" min="1" max={availableAmount} placeholder={'Max: ' + availableAmount} value={this.state.depositAmount || ''} onChange={this.updateDepositAmount} class="depositinput" />
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount / 4)}>25%</button>
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount / 2)}>50%</button>
                                <button type="button" class="dwmbutton hidesmmd" onClick={() => this.setDepositAmount(availableAmount * 3 / 4)}>75%</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount / 4)}>&frac14;</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount / 2)}>&frac12;</button>
                                <button type="button" class="dwmbutton hidelg" onClick={() => this.setDepositAmount(availableAmount * 3 / 4)}>&frac34;</button>
                                <button type="button" class="maxbuttons" onClick={this.maxDepositAmount}>Max</button>
                              </div>
                            </div>
                          </div>
                          <div class="tw-mb-3 tw-form-control nobutton">
                            <label class="tw-label">
                              <span class="tw-label-text">
                                {resources.VESTING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </span>
                            </label>
                            <div class="tw-mb-3 tw-flex">
                              <input type="number" min="1" max={this.state.factoredVestingBlocksMax} placeholder={'Max: ' + this.state.factoredVestingBlocksMax} value={this.state.factoredVestingBlocks || ''} onChange={this.updateVestingBlocks} class="depositinput w-full" />
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ weeks: 1 }))}>Week</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addVestingBlocks(blocksPerDuration({ months: 1 }))}>Month</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ weeks: 1 }))} title="Week">W</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addVestingBlocks(blocksPerDuration({ months: 1 }))} title="Month">M</button>
                              <button type="button" class="maxbuttons" onClick={this.maxVestingBlocks}>Max</button>
                            </div>
                            <p class="approxLabel">{blocksDurationText(this.state.factoredVestingBlocks)}</p>
                          </div>
                          <div class="tw-mb-3 tw-form-control nobutton">
                            <label class="tw-label">
                              <span class="tw-label-text">
                                {resources.UNBONDING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.UNBONDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer tw-minustop" />
                              </span>
                            </label>
                            <div class="tw-mb-3 tw-flex">
                              <input type="number" min="1" max={this.state.factoredUnbondingBlocksMax} placeholder={'Max: ' + this.state.factoredUnbondingBlocksMax} value={this.state.factoredUnbondingBlocks || ''} onChange={this.updateUnbondingBlocks} class="depositinput" />
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))}>Minute</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ hours: 1 }))}>Hour</button>
                              <button type="button" class="dwmbutton hidesmmd" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))} title="Minute">M</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ hours: 1 }))} title="Hour">H</button>
                              <button type="button" class="dwmbutton hidelg" onClick={() => this.addUnbondingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                              <button type="button" class="maxbuttons" onClick={this.maxUnbondingBlocks}>Max</button>
                            </div>
                            <p class="approxLabel">{blocksDurationText(this.state.factoredUnbondingBlocks)}</p>
                          </div>
                          <div class="tw-mb-3 tw-form-control">
                            <button type="button" className='tw-btn tw-btn-accent tw-mt-5 tw-text-xl tw-font-black hover:tw-bg-yellow-200' disabled={this.state.optimumVestingBlocks === 0 || this.state.optimumVestingBlocks === 0} onClick={this.maximiseApy}>Maximise APY</button>
                          </div>
                          <div class="tw-shadow-sm bottomstats tw-stats stats">
                            <div class="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                              <div class="tw-stat-title">
                                {resources.VESTIMATED_REWARD.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTIMATED_REWARD)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </div>
                              <div class="tw-stat-value tw-text-accent">{this.state.vestimatedReward.toLocaleString()}</div>
                              <div class="tw-stat-desc">{token}</div>
                            </div>
                            <div class="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                              <div class="tw-stat-title">
                                {resources.VESTIMATED_APY.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.VESTIMATED_APY)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </div>
                              <div class="tw-stat-value tw-text-accent">{this.state.vestimatedApy}</div>
                              <div class="tw-stat-desc">%</div>
                            </div>
                          </div>
                          <div class="tw-mb-3 tw-form-control">
                            <button type="button" className='tw-btn tw-btn-accent tw-mt-5 tw-text-xl tw-font-black hover:tw-bg-yellow-200' disabled={this.state.depositAmount < 1 || this.state.vestingBlocks < 1 || this.state.unbondingBlocks < 1 || this.state.depositAmount > availableAmount} onClick={this.addDeposit}>Deposit</button>
                          </div>
                        </fieldset>
                      </form>
                    </div>
                    <div class="tw-grid tw-mt-4">

                      {this.state.vestiplotProgress > 0 && this.state.vestiplotProgress < 100 && (
                        <div class="tw-overlay tw-z-20">
                          <div class="overlayloader tw-flex tw-flex-col tw-items-center tw-justify-center ">
                            <div>
                              <Loader type="Puff" color="#00BFFF" />
                            </div>
                            <div>
                              <p class="approxLabel tw-mt-4">{this.state.vestiplotProgress}%</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div class="plotcontainer tw-z-10">
                        <div class="tw-flex tw-flex-col xl:tw-flex-row">

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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {this.state.farmingSummary.length > 0 && (
                  <div class="summarytable">
                    <h3 class="tw-mb-5 headingfont sectiontitle tw-mt-10">{resources.FARMING_SUMMARY.TITLE}</h3>
                    <div class="tw-overflow-x-auto tw-text-secondary tw-my-5">
                      {this.renderFarmingSummaryTable(this.state.farmingSummary)}
                    </div>
                  </div>
                )}

                {this.state.unbondingSummary.length > 0 && this.state.unbondingSummary.some(u => parseInt(u.expiryBlock) - this.state.blockNumber > 0) && (
                  <div class="summarytable">
                    <h3 class="tw-mb-5 tw-headingfont tw-sectiontitle tw-mt-10">{resources.UNBONDING_SUMMARY.TITLE}</h3>
                    <div class="tw-overflow-x-auto tw-text-secondary tw-my-5">
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

  //#endregion
}
