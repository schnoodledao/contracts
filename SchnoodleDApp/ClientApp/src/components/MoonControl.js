import React, { Component } from 'react';
import { resources } from '../resources';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV7 from "../contracts/SchnoodleV7.json";
import SchnoodleFarming from "../contracts/SchnoodleFarmingV1.json";
import getWeb3 from "../getWeb3";
import { initializeHelpers, scaleDownUnits, calculateApy, blocksDurationText } from '../helpers';

// Third-party libraries
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
const bigInt = require("big-integer");

export class MoonControl extends Component {
  static displayName = MoonControl.name;
  
  constructor(props) {
    super(props);

    this.state = {
      success: false,
      message: null,
      web3: null,
      schnoodle: null,
      schnoodleFarming: null,
      getInfoIntervalId: 0,
      decimals: null,
      blockNumber: 0,
      farmingSummary: [],
      openHelpModal: false,
      helpTitle: '',
      helpInfo: '',
      helpDetails: ''
    };

    this.closeHelpModal = this.closeHelpModal.bind(this);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const schnoodleDeployedNetwork = SchnoodleV1.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(SchnoodleV7.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleFarmingDeployedNetwork = SchnoodleFarming.networks[await web3.eth.net.getId()];
      const schnoodleFarming = new web3.eth.Contract(SchnoodleFarming.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
      await initializeHelpers(await schnoodle.methods.decimals().call());

      this.setState({ web3, schnoodle, schnoodleFarming }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 60000);
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
  }

  async getInfo() {
    const { web3, schnoodleFarming } = this.state;

    const blockNumber = await web3.eth.getBlockNumber();

    this.setState({ blockNumber }, async () => {
      const depositedEvents = await schnoodleFarming.getPastEvents('Deposited', { fromBlock: 0, toBlock: 'latest' });
      const accounts = [...new Set(await depositedEvents.map((depositedEvent) => depositedEvent.returnValues.account))];
      const farmingSummary = (await Promise.all(accounts.map(async (account) => {
        return (await Promise.all((await schnoodleFarming.methods.getFarmingSummary(account).call()).map(async (depositReward) => {
          try {
            const deposit = depositReward.deposit;
            const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
            const vestimatedApy = calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(account, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber)
            return { account: account, deposit: deposit, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
          } catch (err) {
            if (err.message.includes('deposit not found')) {
              return null;
            }
            throw err;
          }
        }))).filter(depositInfo => depositInfo != null);
      }))).flat();

      this.setState({ farmingSummary });
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
            <span role="columnheader">
              {resources.FARMING_OVERVIEW.ACCOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_OVERVIEW.ACCOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
            <span role="columnheader">
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
            <span role="columnheader">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} class="h-4 w-4 inline-block ml-2 cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="text-secondary">
          {farmingSummary.map((depositInfo) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = Math.max(0, parseInt(depositInfo.deposit.blockNumber) + parseInt(depositInfo.deposit.vestingBlocks) - this.state.blockNumber);
            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_OVERVIEW.ACCOUNT.TITLE + ":"} class="border-l-0">{depositInfo.account}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} class="border-l-0">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} title={blocksDurationText(depositInfo.deposit.unbondingBlocks)}>{depositInfo.deposit.unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} class="narrow" >{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} class="narrow" >{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"}>{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  render() {
    const subtitle1 = 'All moon farms.';
    const subtitle2 = 'One single view.';

    if (!this.state.web3) {
      return (
        <div class="overflow-hidden antialiased font-roboto mx-4">
          <div class="h-noheader md:flex">
            <div class="flex items-center justify-center w-full">
              <div class="px-4">
                <img class="object-cover w-1/2 my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles uppercase">{resources.MOON_CONTROL}</div>
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
      <div class="mooncontrol w-100">
        <div class="m-auto px-4 max-w-screen-2xl">
          <div class="h-noheader overflow-hidden mx-2 md:m-auto font-roboto">
            <div class="text-center px-1 md:px-4">
              <div class="text-base-200 w-full">
                <h1 class="mt-10 mb-2 maintitles leading-tight text-center md:text-left uppercase">{resources.MOON_CONTROL}</h1>
                <p class="my-2 text-2xl md:text-3xl leading-tight titlefont w-2/3 md:w-full m-auto md:mx-0 textfade from-green-400 to-purple-500">
                  <span class="block md:hidden text-center">{subtitle1}<br />{subtitle2}</span>
                  <span class="hidden md:block text-left">{subtitle1} {subtitle2}</span>
                </p>

                <video class="m-auto max-h-80" autoPlay muted loop src="../../assets/vid/mp4/rotating-moon.mp4" type="video/mp4" />

                {this.state.farmingSummary.length > 0 && (
                  <div class="summarytable">
                    <h3 class="mb-5 headingfont sectiontitle mt-10">{resources.FARMING_OVERVIEW.TITLE}</h3>
                    <div class="overflow-x-auto text-secondary my-5 ">
                      {this.renderFarmingSummaryTable(this.state.farmingSummary)}
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
