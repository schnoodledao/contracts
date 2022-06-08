// ReSharper disable InconsistentNaming
import React, { useState, useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { general, farming as resources } from '../resources';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import SchnoodleFarmingV1 from '../contracts/SchnoodleFarmingV1.json';
import SchnoodleFarmingV2 from '../contracts/SchnoodleFarmingV2.json';
import { initializeHelpers, handleError, getWeb3, scaleDownUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks } from '../helpers';
import { IHelpData } from '../types';

// Third-party libraries
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import chroma from 'chroma-js';
import Globe from 'react-globe.gl';
const bigInt = require('big-integer');
// ReSharper restore InconsistentNaming

interface IContractData {
    web3: any,
    schnoodle: any,
    schnoodleFarming: any,
}

interface IFactorData {
    factoredVestingBlocks: number,
    factoredVestingBlocksMax: number
    factoredUnbondingBlocks: number,
    factoredUnbondingBlocksMax: number,
    vestingBlocksFactor: number,
    unbondingBlocksFactor: number,
}

interface IFarmData {
    lat?: number,
    lng?: number,
    radius?: number,
    altitude?: number,
    pointColor?: any,
    depositInfo?: any,
    ringColor?: any,
    maxRadius?: number,
    propagationSpeed?: number,
    repeatPeriod?: number,
}

interface IStatus {
  success: boolean,
  message: string,
}

interface IDepositInfo {
    account: string,
    deposit: {
        amount: number
    },
    reward: number,
    vestimatedApy: number,
}

interface IArc {
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
}

const MoonControl: React.FC<{}> = () => {
  const [globeClickPoint, setGlobeClickPoint] = useState(null);
  const [farmingOverview, setFarmingOverview] = useState([]);
  const [contracts, setContracts] = useState<IContractData>();
  const [getInfoIntervalId, setGetInfoIntervalId] = useState<NodeJS.Timer | undefined>();
  const [openModal, setOpenHelpModal] = useState(false);
  const [arcsData, setArcsData] = useState<IArc[]>();
  const [farmData, setFarmData] = useState<IFarmData[]>();
  const [status, setStatus] = useState<IStatus>();
  const [factors, setFactors] = useState<IFactorData>();
  const [blockNumber, setBlockNumber] = useState<number>();
  const [helpInfo, setHelpInfo] = useState<IHelpData>();
  const globeRef = useRef(null);
  const globeEl = useRef(null);
  const ARC_REL_LEN = 0.4;
  const FLIGHT_TIME = 1000;

  useEffect(() => {
    if (contracts) {
      getInfo();
      const getInfoIntervalId = setInterval(async () => await getInfo(), 60000);
      setGetInfoIntervalId(getInfoIntervalId);
      const globeElControls = (globeEl as any).current.controls();
      globeElControls.autoRotate = true;
      globeElControls.autoRotateSpeed = 0.5;
    }
  }, [contracts])

  useEffect(() => {
    try {
      const fetchData =  async () => {
        const web3 = await getWeb3();
        const schnoodleDeployedNetwork = (SchnoodleV1 as any).networks[await web3.eth.net.getId()];
        const schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
        const schnoodleFarmingDeployedNetwork = (SchnoodleFarmingV1 as any).networks[await web3.eth.net.getId()];
        const schnoodleFarming = new web3.eth.Contract(SchnoodleFarmingV2.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
        await initializeHelpers(await schnoodle.methods.decimals().call());

        (window as any).ethereum.on('networkChanged', () => window.location.reload());
        setContracts({ web3, schnoodle, schnoodleFarming });
      }
      fetchData();
      // Set up the moon globe

    } catch (err) {
      handleError(err, setStatus);
    }
    return () => {
      clearInterval(getInfoIntervalId);
    }
  }, [])

  const getInfo = async () => {
    const { web3, schnoodleFarming } = contracts;

    const blockNumber = await web3.eth.getBlockNumber();
    setBlockNumber(blockNumber);
      
    const fetchData = async () => {
      const farmingStartBlock = 13761101;
      const topicsOld = [web3.utils.sha3('Deposited(address,uint256,uint256)')];
      const topicsNew = [web3.utils.sha3('Deposited(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)')];
      const depositedEvents = (await getPastLogs(topicsOld, farmingStartBlock, blockNumber)).concat(await getPastLogs(topicsNew, farmingStartBlock, blockNumber));

      // Divide and conquer strategy to address query timeouts when getting past events (https://ethereum.stackexchange.com/a/84836/63971)
      async function getPastLogs(topics: any, fromBlock: any, toBlock: any) {
        try {
          return await web3.eth.getPastLogs({ fromBlock, toBlock, address: schnoodleFarming._address, topics });
        } catch (err) {
          const midBlock = (fromBlock + toBlock) >> 1;
          const arr1: any = await getPastLogs(topics, fromBlock, midBlock);
          const arr2: any = await getPastLogs(topics, midBlock + 1, toBlock);
          return [...arr1, ...arr2];
        }
      }

      const accounts = [...new Set<string>(await depositedEvents.map((depositedEvent: any) => `0x${depositedEvent.topics[1].slice(26)}`))];
      const vestingBlocksFactor = await schnoodleFarming.methods.getVestingBlocksFactor().call() / 1000;
      const unbondingBlocksFactor = await schnoodleFarming.methods.getUnbondingBlocksFactor().call() / 1000;

      const farmingOverview = (await Promise.all(accounts.map(async (account) => {
        return (await Promise.all((await schnoodleFarming.methods.getFarmingSummary(account).call()).map(async (depositReward: any) => {
          try {
            const deposit = depositReward.deposit;
            const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
            const vestimatedApy = calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(account, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber);
            const created = new Date((await web3.eth.getBlock(deposit.blockNumber)).timestamp * 1000);
            return { account: account, deposit: deposit, created: created, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
          } catch (err) {
            if ((err as any).message.includes('deposit not found')) {
              return null;
            }
            throw err;
          }
        }))).filter(depositInfo => depositInfo != null);
      }))).flat();

      const farmCounts: {[key: string]: number} = {};
      const farmData = farmingOverview.map((depositInfo: IDepositInfo) => {
        // Track the number of farms for each account so that they can be clustered around each other on the Metamoon
        if (!(depositInfo.account in farmCounts)) {
          farmCounts[depositInfo.account] = 0;
        } else {
          farmCounts[depositInfo.account]++;
        }

        const farmPoint = getFarmPoint(depositInfo.account);

        return {
          lat: farmPoint.lat + 2 * (farmCounts[depositInfo.account] / 3),
          lng: farmPoint.lng + 2 * (farmCounts[depositInfo.account] % 3),
          radius: Math.log10(scaleDownUnits(depositInfo.deposit.amount)) ** 2 / 10 / (2 * Math.PI), // Base the radius on the order of magnitude of the deposit
          altitude: depositInfo.reward / depositInfo.deposit.amount,
          pointColor: depositInfo.account.slice(depositInfo.account.length - 6),
          depositInfo: depositInfo,
          ringColor: chroma.scale(['green', 'red'])(getPendingBlocksAmount(depositInfo) / blocksPerDuration({ months: 3 })).toString(),
          maxRadius: Math.min(depositInfo.vestimatedApy, 20) / 2,
          propagationSpeed: 1,
          repeatPeriod: 700
        }
      });
      setFactors({ ...factors, vestingBlocksFactor: vestingBlocksFactor, unbondingBlocksFactor: unbondingBlocksFactor });
      setFarmData(farmData);
      setFarmingOverview(farmingOverview);
    };
    fetchData();
  };

  const getPendingBlocksAmount = (depositInfo: any) => {
    return getPendingBlocks(Math.floor(depositInfo.deposit.vestingBlocks * factors?.vestingBlocksFactor), depositInfo.deposit.blockNumber, blockNumber);
  }

  //#region Help functions

  const openHelpModal = (content: any) => {
    setHelpInfo({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS });
    setOpenHelpModal(true);
  }

  const closeHelpModal = () => {
    setOpenHelpModal(false);
  }

  //#endregion

  //#region Metamoon

  const renderMoonFarms = () => {
    return (
      <div ref={globeRef as any} className="tw-justify-center tw-flex">
        <Globe
          ref={globeEl as any}
          globeImageUrl="../../assets/img/jpg/lunar_surface.jpg"
          bumpImageUrl="../../assets/img/jpg/lunar_bumpmap.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          pointsData={farmData as any}
          pointRadius="radius"
          pointAltitude="altitude"
          pointColor="pointColor"
          pointLabel={(d: any) => farmInfo(d.depositInfo)}
          onPointClick={(point: any) => { onPointClick(point) }}
          onPointRightClick={() => (globeEl as any).current.controls().autoRotate = false}
          onPointHover={() => (globeEl as any).current.controls().autoRotate = true}

          ringsData={farmData?.slice(0)}
          ringColor="ringColor"
          ringMaxRadius="maxRadius"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"

          arcsData={arcsData}
          arcColor={() => 'darkOrange'}
          arcDashLength={ARC_REL_LEN}
          arcDashGap={2}
          arcDashInitialGap={1}
          arcDashAnimateTime={FLIGHT_TIME}
          arcsTransitionDuration={0}
        />
      </div>
    );
  }

  const farmInfo = (depositInfo: any) => {
    const pendingBlocks = getPendingBlocksAmount(depositInfo);
    const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * factors.unbondingBlocksFactor);

    return ReactDOMServer.renderToString((
      <div className="moontip">
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

  const showMoonFarm = (account: any) => {
    (globeEl as any).current.pointOfView(getFarmPoint(account), 2000);
    (globeRef as any).current.scrollIntoView({ behavior: 'smooth' });
  }

  const getFarmPoint = (account: string) => {
    const addressParts = account.match(/.{1,22}/g);
    const denominator = 2 ** 80;
    return { lat: 180 * parseInt(addressParts[0]) / denominator - 90, lng: 360 * (parseInt('0x' + addressParts[1])) / denominator - 180 };
  }

  const onPointClick = (point: any) => {
    if (globeClickPoint != null) {
      const { lat: startLat, lng: startLng } = globeClickPoint;

      // Add and remove arc after 1 cycle
      const arc = { startLat, startLng, endLat: point.lat, endLng: point.lng };
      setArcsData([...arcsData, arc]);
      setTimeout(() => setArcsData(arcsData.filter((d: any) => d !== arc)), FLIGHT_TIME * 2);

      // add and remove target rings
      setTimeout(() => {
        const targetRing = { lat: point.lat, lng: point.lng, ringColor: 'orange', maxRadius: 5, propagationSpeed: 5, repeatPeriod: FLIGHT_TIME * ARC_REL_LEN / 3 };
        setFarmData([...farmData, targetRing]);
        setTimeout(() => setFarmData(farmData.filter((r: any) => r !== targetRing)), FLIGHT_TIME);
      }, FLIGHT_TIME);
    }

    setGlobeClickPoint({ lat: point.lat, lng: point.lng });
  };

  //#endregion

  //#region Rendering

  const renderFarmingOverviewTable = (farmingOverview: any) => {
    const space = ' ';
    const blockNumberTitleParts = resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE.split(space);
    const depositAmountTitleParts = resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE.split(space);
    const pendingBlocksTitleParts = resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE.split(space);
    const unbondingBlocksTitleParts = resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE.split(space);
    const vestimatedApyTitleParts = resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE.split(space);
    const currentRewardTitleParts = resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE.split(space);

    return (
      <div role="table" aria-label={resources.FARMING_SUMMARY.TITLE} className="tw-border-secondary tw-border-4 tw-rounded-2xl tw-text-accent-content">
        <div role="rowgroup" className="columnheader-group">
          <div role="row">
            <span role="columnheader" className="wider">
              {resources.FARMING_OVERVIEW.ACCOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_OVERVIEW.ACCOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {resources.FARMING_SUMMARY.CREATED.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.CREATED)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {pendingBlocksTitleParts[0]}<br />{pendingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.PENDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {unbondingBlocksTitleParts[0]}<br />{unbondingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.UNBONDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {vestimatedApyTitleParts[0]}<br />{vestimatedApyTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.VESTIMATED_APY)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {resources.FARMING_SUMMARY.MULTIPLIER.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.MULTIPLIER)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="wide">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" className="text-secondary">
          {farmingOverview.map((depositInfo: any) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = getPendingBlocksAmount(depositInfo);
            const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * factors.unbondingBlocksFactor);

            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_OVERVIEW.ACCOUNT.TITLE + ":"} className="tw-border-l-0 tw-cursor-pointer wider" onClick={() => showMoonFarm(depositInfo.account)}>{depositInfo.account}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} className="tw-border-l-0 narrow">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ":"} className="narrow" title={depositInfo.created.toLocaleTimeString()}>{depositInfo.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"} >{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} className="narrow" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} className="narrow" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} className="narrow">{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} className="narrow">{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"} className="wide">{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const subtitle1 = 'All moon farms.';
  const subtitle2 = 'One single view.';

  if (!contracts?.web3) {
    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="tw-h-noheader md:tw-flex">
          <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
              <div className="maintitles tw-uppercase">{resources.MOON_CONTROL}</div>
              <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
              <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{general.LOADING}<span>.</span><span>.</span><span>.</span></p>
              <div className="tw-px-4 tw-mt-4 fakebutton">&nbsp;</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mooncontrol tw-w-100">
      <div className="tw-m-auto tw-px-4 tw-max-w-screen-2xl">
        <div className="tw-h-noheader tw-overflow-hidden tw-mx-2 md:tw-m-auto tw-font-roboto">
          <div className="tw-text-center tw-px-1 md:tw-px-4">
            <div className="tw-text-base-200 tw-w-full">
              <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.MOON_CONTROL}</h1>
              <p className="tw-my-2 tw-text-2xl md:tw-text-3xl tw-leading-tight titlefont tw-w-2/3 md:tw-w-full tw-m-auto md:tw-mx-0 textfade tw-from-green-400 tw-to-purple-500">
                  <span className="tw-block md:tw-hidden tw-text-center">{subtitle1}<br />{subtitle2}</span>
                  <span className="tw-hidden md:tw-block tw-text-left">{subtitle1} {subtitle2}</span>
              </p>

              {renderMoonFarms()}

              {farmingOverview.length > 0 &&
                  <div className="summarytable">
                  <h3 className="tw-mb-5 headingfont sectiontitle tw-mt-10">{resources.FARMING_OVERVIEW.TITLE}</h3>
                  <div className="tw-overflow-x-auto tw-text-secondary tw-my-5 ">
                      {renderFarmingOverviewTable(farmingOverview)}
                  </div>
                  </div>
              }

              <div className="tw-my-5">
                  <p style={{ color: status?.success ? 'green' : 'red' }}>{status?.message}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <Modal open={openModal} onClose={closeHelpModal} center classNames={{ overlay: 'customOverlay', modal: 'customModal' }}>
              <h1>{helpInfo?.helpTitle}</h1>
              <p>{helpInfo?.helpInfo}</p>
              <br />
              <p>{helpInfo?.helpDetails}</p>
          </Modal>
        </div>
      </div>
    </div>
  );
  //#endregion
}

MoonControl.displayName = MoonControl.name;
export default MoonControl;
