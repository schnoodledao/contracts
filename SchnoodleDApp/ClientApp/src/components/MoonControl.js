import React, { Component } from 'react';
import ReactDOMServer from 'react-dom/server';
import { resources } from '../resources';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV8 from "../contracts/SchnoodleV8.json";
import SchnoodleFarmingV1 from "../contracts/SchnoodleFarmingV1.json";
import SchnoodleFarmingV2 from "../contracts/SchnoodleFarmingV2.json";
import getWeb3 from "../getWeb3";
import { initializeHelpers, scaleDownUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks } from '../helpers';

// Third-party libraries
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import chroma from 'chroma-js';
import Globe from "react-globe.gl";
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
      blockNumber: 0,
      vestingBlocksFactor: 0,
      unbondingBlocksFactor: 0,
      farmingOverview: [],
      farmData: null,
      arcsData: [],
      globeClickPoint: null,
      openHelpModal: false,
      helpTitle: '',
      helpInfo: '',
      helpDetails: ''
    };

    this.closeHelpModal = this.closeHelpModal.bind(this);
    this.globeRef = React.createRef();
    this.globeEl = React.createRef();
    this.ARC_REL_LEN = 0.4;
    this.FLIGHT_TIME = 1000;
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const schnoodleDeployedNetwork = SchnoodleV1.networks[await web3.eth.net.getId()];
      const schnoodle = new web3.eth.Contract(SchnoodleV8.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
      const schnoodleFarmingDeployedNetwork = SchnoodleFarmingV1.networks[await web3.eth.net.getId()];
      const schnoodleFarming = new web3.eth.Contract(SchnoodleFarmingV2.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
      await initializeHelpers(await schnoodle.methods.decimals().call());

      this.setState({ web3, schnoodle, schnoodleFarming }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 60000);
        this.setState({ getInfoIntervalId });
      });
    
      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));

      // Set up Moon globe
      const globeElControls = this.globeEl.current.controls();
      globeElControls.autoRotate = true;
      globeElControls.autoRotateSpeed = 0.5;

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
      const farmingStartBlock = 13761101;
      const topicsOld = [web3.utils.sha3('Deposited(address,uint256,uint256)')];
      const topicsNew = [web3.utils.sha3('Deposited(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)')];
      const depositedEvents = (await getPastLogs(topicsOld, farmingStartBlock, blockNumber)).concat(await getPastLogs(topicsNew, farmingStartBlock, blockNumber));

      // Divide and conquer strategy to address query timeouts when getting past events (https://ethereum.stackexchange.com/a/84836/63971)
      async function getPastLogs(topics, fromBlock, toBlock) {
        try {
          return await web3.eth.getPastLogs({ fromBlock, toBlock, address: schnoodleFarming._address, topics });
        } catch (err) {
          const midBlock = (fromBlock + toBlock) >> 1;
          const arr1 = await getPastLogs(topics, fromBlock, midBlock);
          const arr2 = await getPastLogs(topics, midBlock + 1, toBlock);
          return [...arr1, ...arr2];
        }
      }

      const accounts = [...new Set(await depositedEvents.map((depositedEvent) => `0x${depositedEvent.topics[1].slice(26)}`))];
      const vestingBlocksFactor = await schnoodleFarming.methods.getVestingBlocksFactor().call() / 1000;
      const unbondingBlocksFactor = await schnoodleFarming.methods.getUnbondingBlocksFactor().call() / 1000;

      const farmingOverview = (await Promise.all(accounts.map(async (account) => {
        return (await Promise.all((await schnoodleFarming.methods.getFarmingSummary(account).call()).map(async (depositReward) => {
          try {
            const deposit = depositReward.deposit;
            const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
            const vestimatedApy = calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(account, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber);
            const created = new Date((await web3.eth.getBlock(deposit.blockNumber)).timestamp * 1000);
            return { account: account, deposit: deposit, created: created, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
          } catch (err) {
            if (err.message.includes('deposit not found')) {
              return null;
            }
            throw err;
          }
        }))).filter(depositInfo => depositInfo != null);
      }))).flat();

      let farmCounts = {};
      const farmData = farmingOverview.map((depositInfo) => {
        // Track the number of farms for each account so that they can be clustered around each other on the Metamoon
        if (!(depositInfo.account in farmCounts)) {
          farmCounts[depositInfo.account] = 0;
        } else {
          farmCounts[depositInfo.account]++;
        }

        const farmPoint = this.getFarmPoint(depositInfo.account);

        return {
          lat: farmPoint.lat + 2 * (farmCounts[depositInfo.account] / 3),
          lng: farmPoint.lng + 2 * (farmCounts[depositInfo.account] % 3),
          radius: Math.log10(scaleDownUnits(depositInfo.deposit.amount)) ** 2 / 10 / (2 * Math.PI), // Base the radius on the order of magnitude of the deposit
          altitude: depositInfo.reward / depositInfo.deposit.amount,
          pointColor: depositInfo.account.slice(depositInfo.account.length - 6),
          depositInfo: depositInfo,
          ringColor: chroma.scale(['green', 'red'])(this.getPendingBlocks(depositInfo) / blocksPerDuration({ months: 3 })).toString(),
          maxRadius: Math.min(depositInfo.vestimatedApy, 20) / 2,
          propagationSpeed: 1,
          repeatPeriod: 700
        }
      });

      this.setState({ vestingBlocksFactor, unbondingBlocksFactor, farmingOverview, farmData });
    });
  }

  getPendingBlocks(depositInfo) {
    return getPendingBlocks(Math.floor(depositInfo.deposit.vestingBlocks * this.state.vestingBlocksFactor), depositInfo.deposit.blockNumber, this.state.blockNumber);
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

  //#region Help functions

  openHelpModal(content) {
    this.setState({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS, openHelpModal: true })
  }

  closeHelpModal() {
    this.setState({ openHelpModal: false })
  }

  //#endregion

  //#region Metamoon

  renderMoonFarms() {
    return (
      <div ref={this.globeRef} class="tw-justify-center tw-flex">
        <Globe
          ref={this.globeEl}
          globeImageUrl="../../assets/img/jpg/lunar_surface.jpg"
          bumpImageUrl="../../assets/img/jpg/lunar_bumpmap.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          pointsData={this.state.farmData}
          pointRadius="radius"
          pointAltitude="altitude"
          pointColor="pointColor"
          pointLabel={(d) => this.farmInfo(d.depositInfo)}
          onPointClick={(point) => { this.onPointClick(point) }}
          onPointRightClick={() => this.globeEl.current.controls().autoRotate = false}
          onPointHover={() => this.globeEl.current.controls().autoRotate = true}

          ringsData={this.state.farmData?.slice(0)}
          ringColor="ringColor"
          ringMaxRadius="maxRadius"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"

          arcsData={this.state.arcsData}
          arcColor={() => 'darkOrange'}
          arcDashLength={this.ARC_REL_LEN}
          arcDashGap={2}
          arcDashInitialGap={1}
          arcDashAnimateTime={this.FLIGHT_TIME}
          arcsTransitionDuration={0}
        />
      </div>
    );
  }

  farmInfo(depositInfo) {
    const pendingBlocks = this.getPendingBlocks(depositInfo);
    const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * this.state.unbondingBlocksFactor);

    return ReactDOMServer.renderToString((
      <div class="moontip">
        <span>{`${resources.MOON_FARM_DATA}`}</span>
        <p>{`${resources.FARMING_OVERVIEW.ACCOUNT.TITLE}: ${depositInfo.account}`}</p>
        <p>{`${resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE}: ${depositInfo.deposit.blockNumber}`}</p>
        <p>{`${resources.FARMING_SUMMARY.CREATED.TITLE}: ${depositInfo.created.toLocaleString()}`}</p>
        <p>{`${resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE}: ${scaleDownUnits(depositInfo.deposit.amount).toLocaleString()}`}</p>
        <p>{`${resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE}: ${pendingBlocks} (${blocksDurationText(pendingBlocks)})`}</p>
        <p>{`${resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE}: ${unbondingBlocks} (${blocksDurationText(unbondingBlocks)})`}</p>
        <p>{`${resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE}: ${depositInfo.vestimatedApy}`}%</p>
        <p>{`${resources.FARMING_SUMMARY.MULTIPLIER.TITLE}: ${depositInfo.deposit.multiplier / 1000}`}</p>
        <p>{`${resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE}: ${scaleDownUnits(depositInfo.reward).toLocaleString()}`}</p>
      </div>
    ));
  }

  showMoonFarm(account) {
    this.globeEl.current.pointOfView(this.getFarmPoint(account), 2000);
    this.globeRef.current.scrollIntoView({ behavior: 'smooth' });
  }

  getFarmPoint(account) {
    const addressParts = account.match(/.{1,22}/g);
    const denominator = 2 ** 80;
    return { lat: 180 * addressParts[0] / denominator - 90, lng: 360 * ('0x' + addressParts[1]) / denominator - 180 };
  }

  onPointClick(point) {
    if (this.state.globeClickPoint != null) {
      const { lat: startLat, lng: startLng } = this.state.globeClickPoint;

      // Add and remove arc after 1 cycle
      const arc = { startLat, startLng, endLat: point.lat, endLng: point.lng };
      this.setState({ arcsData: [...this.state.arcsData, arc] });
      setTimeout(() => this.setState({ arcsData: this.state.arcsData.filter(d => d !== arc) }), this.FLIGHT_TIME * 2);

      // add and remove target rings
      setTimeout(() => {
        const targetRing = { lat: point.lat, lng: point.lng, ringColor: 'orange', maxRadius: 5, propagationSpeed: 5, repeatPeriod: this.FLIGHT_TIME * this.ARC_REL_LEN / 3 };
        this.setState({ farmData: [...this.state.farmData, targetRing] });
        setTimeout(() => this.setState({ farmData: this.state.farmData.filter(r => r !== targetRing) }), this.FLIGHT_TIME);
      }, this.FLIGHT_TIME);
    }

    this.setState({ globeClickPoint: { lat: point.lat, lng: point.lng } });
  };

  //#endregion

  //#region Rendering

  renderFarmingOverviewTable(farmingOverview) {
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
            <span role="columnheader" class="wider">
              {resources.FARMING_OVERVIEW.ACCOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_OVERVIEW.ACCOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {resources.FARMING_SUMMARY.CREATED.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CREATED)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {pendingBlocksTitleParts[0]}<br />{pendingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.PENDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {unbondingBlocksTitleParts[0]}<br />{unbondingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.UNBONDING_BLOCKS)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {vestimatedApyTitleParts[0]}<br />{vestimatedApyTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.VESTIMATED_APY)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="narrow">
              {resources.FARMING_SUMMARY.MULTIPLIER.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.MULTIPLIER)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" class="wide">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => this.openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} class="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" class="text-secondary">
          {farmingOverview.map((depositInfo) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = this.getPendingBlocks(depositInfo);
            const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * this.state.unbondingBlocksFactor);

            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_OVERVIEW.ACCOUNT.TITLE + ":"} class="tw-border-l-0 tw-cursor-pointer wider" onClick={() => this.showMoonFarm(depositInfo.account)}>{depositInfo.account}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} class="tw-border-l-0 narrow">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ":"}  class="narrow" title={depositInfo.created.toLocaleTimeString()}>{depositInfo.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"} >{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} class="narrow" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} class="narrow" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} class="narrow">{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} class="narrow">{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"} class="wide">{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
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
        <div class="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
          <div class="tw-h-noheader md:tw-flex">
            <div class="tw-flex tw-items-center tw-justify-center tw-w-full">
              <div class="tw-px-4">
                <img class="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div class="maintitles tw-uppercase">{resources.MOON_CONTROL}</div>
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
      <div class="mooncontrol tw-w-100">
        <div class="tw-m-auto tw-px-4 tw-max-w-screen-2xl">
          <div class="tw-h-noheader tw-overflow-hidden tw-mx-2 md:tw-m-auto tw-font-roboto">
            <div class="tw-text-center tw-px-1 md:tw-px-4">
              <div class="tw-text-base-200 tw-w-full">
                <h1 class="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.MOON_CONTROL}</h1>
                <p class="tw-my-2 tw-text-2xl md:tw-text-3xl tw-leading-tight titlefont tw-w-2/3 md:tw-w-full tw-m-auto md:tw-mx-0 textfade tw-from-green-400 tw-to-purple-500">
                  <span class="tw-block md:tw-hidden tw-text-center">{subtitle1}<br />{subtitle2}</span>
                  <span class="tw-hidden md:tw-block tw-text-left">{subtitle1} {subtitle2}</span>
                </p>

                {this.renderMoonFarms()}

                {this.state.farmingOverview.length > 0 && (
                  <div class="summarytable">
                    <h3 class="tw-mb-5 headingfont sectiontitle tw-mt-10">{resources.FARMING_OVERVIEW.TITLE}</h3>
                    <div class="tw-overflow-x-auto tw-text-secondary tw-my-5 ">
                      {this.renderFarmingOverviewTable(this.state.farmingOverview)}
                    </div>
                  </div>
                )}

                <div class="tw-my-5">
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
