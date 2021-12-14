import React, { Component } from 'react';
import ReactDOMServer from 'react-dom/server';
import { resources } from '../resources';
import SchnoodleV1 from "../contracts/SchnoodleV1.json";
import SchnoodleV7 from "../contracts/SchnoodleV7.json";
import SchnoodleFarming from "../contracts/SchnoodleFarmingV1.json";
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
      farmingOverview: [],
      farmData: null,
      arcsData: [],
      globeClickPoint: { lat: 0, lng: 0 },
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
      const depositedEvents = await schnoodleFarming.getPastEvents('Deposited', { fromBlock: 0, toBlock: 'latest' });
      const accounts = [...new Set(await depositedEvents.map((depositedEvent) => depositedEvent.returnValues.account))];
      const farmingOverview = (await Promise.all(accounts.map(async (account) => {
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

      let farmCounts = {};
      const farmData = farmingOverview.map((depositInfo) => {
        if (!(depositInfo.account in farmCounts)) {
          farmCounts[depositInfo.account] = 0;
        } else {
          farmCounts[depositInfo.account]++;
        }

        const farmPoint = this.getFarmPoint(depositInfo.account);

        return {
          lat: farmPoint.lat + (farmCounts[depositInfo.account] % 2 === 0 ? farmCounts[depositInfo.account] * 2 : 0),
          lng: farmPoint.lng + (farmCounts[depositInfo.account] % 2 === 1 ? farmCounts[depositInfo.account] * 2 : 0),
          radius: Math.log10(scaleDownUnits(depositInfo.deposit.amount)) ** 2 / 10 / (2 * Math.PI), // Base the radius on the order of magnitude of the deposit
          altitude: depositInfo.reward / depositInfo.deposit.amount,
          pointColor: depositInfo.account.slice(depositInfo.account.length - 6),
          depositInfo: depositInfo,
          ringColor: chroma.scale(['green', 'red'])(getPendingBlocks(depositInfo.deposit, this.state.blockNumber) / blocksPerDuration({ months: 3 })).toString(),
          maxRadius: Math.min(depositInfo.vestimatedApy, 20) / 2,
          propagationSpeed: 1,
          repeatPeriod: 700,
        }
      });

      this.setState({ farmingOverview, farmData });
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

  renderMoonFarms() {
    return (
      <div ref={this.globeRef} class="justify-center flex">
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
    const pendingBlocks = getPendingBlocks(depositInfo.deposit, this.state.blockNumber);

    return ReactDOMServer.renderToString((
      <div>
        <p>{`${resources.FARMING_OVERVIEW.ACCOUNT.TITLE}: ${depositInfo.account}`}</p>
        <p>{`${resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE}: ${depositInfo.deposit.blockNumber}`}</p>
        <p>{`${resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE}: ${scaleDownUnits(depositInfo.deposit.amount).toLocaleString()}`}</p>
        <p>{`${resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE}: ${pendingBlocks} (${blocksDurationText(pendingBlocks)})`}</p>
        <p>{`${resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE}: ${depositInfo.deposit.unbondingBlocks} (${blocksDurationText(depositInfo.deposit.unbondingBlocks)})`}</p>
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
    this.globeEl.current.controls().autoRotate = false;

    const { lat: startLat, lng: startLng } = this.state.globeClickPoint;
    this.setState({ globeClickPoint: { lat: point.lat, lng: point.lng } });

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
  };

  renderFarmingOverviewTable(farmingOverview) {
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
          {farmingOverview.map((depositInfo) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = getPendingBlocks(depositInfo.deposit, this.state.blockNumber);
            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_OVERVIEW.ACCOUNT.TITLE + ":"} class="border-l-0" onClick={() => this.showMoonFarm(depositInfo.account)} style={{ cursor: 'pointer' }}>{depositInfo.account}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} class="border-l-0">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} title={blocksDurationText(depositInfo.deposit.unbondingBlocks)}>{depositInfo.deposit.unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} class="narrow">{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} class="narrow">{depositInfo.deposit.multiplier / 1000}</span>
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

                {this.renderMoonFarms()}

                {this.state.farmingOverview.length > 0 && (
                  <div class="summarytable">
                    <h3 class="mb-5 headingfont sectiontitle mt-10">{resources.FARMING_OVERVIEW.TITLE}</h3>
                    <div class="overflow-x-auto text-secondary my-5 ">
                      {this.renderFarmingOverviewTable(this.state.farmingOverview)}
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
