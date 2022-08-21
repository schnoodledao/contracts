// ReSharper disable InconsistentNaming
import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { general, farming as resources } from '../resources';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV10.json';
import SchnoodleFarmingV1 from '../contracts/SchnoodleFarmingV1.json';
import SchnoodleFarming from '../contracts/SchnoodleFarmingV2.json';
import { initializeHelpers, handleError, getWeb3, scaleDownUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks } from '../helpers';
import { IStatus, IHelpData } from '../types';

// Third-party libraries
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import chroma from 'chroma-js';
import Globe from 'react-globe.gl';
import { Contract } from 'web3-eth-contract';
import { GlobeMethods } from 'react-globe.gl/dist/react-globe.gl.d';
// ReSharper restore InconsistentNaming

interface ICoordinates {
  lat: number,
  lng: number,
}

interface IDeposit {
  id: number,
  amount: bigint,
  blockNumber: number,
  vestingBlocks: number,
  unbondingBlocks: number,
  multiplier: number,
}

interface IFarm {
  account: string,
  deposit: IDeposit,
  created: Date,
  reward: bigint,
  vestimatedApy: number,
}

interface IFarmVisual {
  lat: number,
  lng: number,
  radius: number | undefined,
  altitude: number | undefined,
  pointColor: string | undefined,
  farm: IFarm | undefined,
  ringColor: string,
  maxRadius: number,
  propagationSpeed: number,
  repeatPeriod: number,
}

interface IArc {
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
}

const MoonControl: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [schnoodle, setSchnoodle] = useState<Contract>();
  const [schnoodleFarming, setSchnoodleFarming] = useState<Contract>();
  const [blockNumber, setBlockNumber] = useState(0);

  const [globeClickPoint, setGlobeClickPoint] = useState<ICoordinates>({ lat: 0, lng: 0 });
  const [farmingOverview, setFarmingOverview] = useState<IFarm[]>([]);
  const [openModal, setOpenHelpModal] = useState(false);
  const [arcsData, setArcsData] = useState<IArc[]>([]);
  const [farmData, setFarmData] = useState<IFarmVisual[]>([]);

  const [vestingBlocksFactor, setVestingBlocksFactor] = useState(0);
  const [unbondingBlocksFactor, setUnbondingBlocksFactor] = useState(0);

  const [helpData, setHelpData] = useState<IHelpData>();
  const [status, setStatus] = useState<IStatus>({ success: true, message: null });

  const web3 = getWeb3();

  const globeRef = useRef<HTMLDivElement>(null);
  const globeEl = useRef<GlobeMethods | undefined>();
  const ARC_REL_LEN = 0.4;
  const FLIGHT_TIME = 1000;

  useEffect(() => {
    const initialize = async () => {
      try {
        const networkId = await web3.eth.net.getId();
        const schnoodleNetwork = SchnoodleV1.networks[networkId];
        const schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleNetwork.address);
        const schnoodleFarmingNetwork = SchnoodleFarmingV1.networks[networkId];
        const schnoodleFarming = new web3.eth.Contract(SchnoodleFarming.abi, schnoodleFarmingNetwork.address);

        await initializeHelpers(await schnoodle.methods.decimals().call());

        setSchnoodle(schnoodle);
        setSchnoodleFarming(schnoodleFarming);
      } catch (err) {
        handleError(err as Error, setStatus);
      }
    }

    initialize();
  }, [])

  const getPendingBlocksAmount = useCallback((farm: IFarm): number => {
    return getPendingBlocks(Math.floor(farm.deposit.vestingBlocks * vestingBlocksFactor), farm.deposit.blockNumber, blockNumber);
  }, [blockNumber, vestingBlocksFactor])

  useEffect(() => {
    if (!initialized) {
      (async function getInfo() {
        if (!schnoodleFarming) return;
        setInitialized(true);

        const blockNumber = await web3.eth.getBlockNumber();
        setBlockNumber(blockNumber);

        const farmingStartBlock = Number(process.env.REACT_APP_FARMING_START_BLOCK);
        const topicsOld = [web3.utils.sha3('Deposited(address,uint256,uint256)')];
        const topicsNew = [web3.utils.sha3('Deposited(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)')];
        const depositedEvents = (await getPastLogs(topicsOld, farmingStartBlock, blockNumber)).concat(await getPastLogs(topicsNew, farmingStartBlock, blockNumber));

        // Divide and conquer strategy to address query timeouts when getting past events (https://ethereum.stackexchange.com/a/84836/63971)
        async function getPastLogs(topics: any, fromBlock: any, toBlock: any) {
          try {
            if (!schnoodleFarming) return;
            return await web3.eth.getPastLogs({ fromBlock, toBlock, address: schnoodleFarming['_address'], topics });
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
          return (await Promise.all((await schnoodleFarming.methods.getFarmingSummary(account).call()).map(async (depositReward: any): Promise<IFarm | null> => {
            try {
              const deposit = depositReward.deposit;
              const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
              return {
                account,
                deposit: {
                  id: Number(deposit.id),
                  amount: BigInt(deposit.amount),
                  blockNumber: Number(deposit.blockNumber),
                  vestingBlocks: Number(deposit.vestingBlocks),
                  unbondingBlocks: Number(deposit.unbondingBlocks),
                  multiplier: Number(deposit.id)
                },
                created: new Date((await web3.eth.getBlock(deposit.blockNumber)).timestamp * 1000),
                reward: BigInt(depositReward.reward),
                vestimatedApy: calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(account, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber)
              };
            } catch (err) {
              if ((err as any).message.includes('deposit not found')) {
                return null;
              }
              throw err;
            }
          }))).filter(farm => farm != null);
        }))).flat();

        const farmCounts: { [key: string]: number } = {};
        const farmData = farmingOverview.map((farm: IFarm) => {
          // Track the number of farms for each account so that they can be clustered around each other on the Metamoon
          if (!(farm.account in farmCounts)) {
            farmCounts[farm.account] = 0;
          } else {
            farmCounts[farm.account]++;
          }

          const farmPoint = getFarmPoint(farm.account);

          return {
            lat: farmPoint.lat + 2 * (farmCounts[farm.account] / 3),
            lng: farmPoint.lng + 2 * (farmCounts[farm.account] % 3),
            radius: Math.log10(scaleDownUnits(farm.deposit.amount)) ** 2 / 10 / (2 * Math.PI), // Base the radius on the order of magnitude of the deposit
            altitude: Number(farm.reward / farm.deposit.amount),
            pointColor: farm.account.slice(farm.account.length - 6),
            farm,
            ringColor: chroma.scale(['green', 'red'])(getPendingBlocksAmount(farm) / blocksPerDuration({ months: 3 })).toString(),
            maxRadius: Math.min(farm.vestimatedApy, 20) / 2,
            propagationSpeed: 1,
            repeatPeriod: 700
          }
        });

        setVestingBlocksFactor(vestingBlocksFactor);
        setUnbondingBlocksFactor(unbondingBlocksFactor);
        setFarmData(farmData);
        setFarmingOverview(farmingOverview);
        setTimeout(getInfo, 10000);
      })();
    }
  }, [schnoodle, schnoodleFarming, getPendingBlocksAmount]);

  useEffect(() => {
      const globeElControls = globeEl.current?.controls() as any;
      globeElControls.autoRotate = true;
      globeElControls.autoRotateSpeed = 0.5;
    }, [])

  //#region Help functions

  const openHelpModal = (content: any) => {
    setHelpData({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS });
    setOpenHelpModal(true);
  }

  const closeHelpModal = () => {
    setOpenHelpModal(false);
  }

  //#endregion

  //#region Metamoon

  const renderMoonFarms = () => {
    return (
      <div ref={globeRef} className="tw-justify-center tw-flex">
        <Globe
          ref={globeEl}
          globeImageUrl="../../assets/img/jpg/lunar_surface.jpg"
          bumpImageUrl="../../assets/img/jpg/lunar_bumpmap.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          pointsData={farmData}
          pointRadius="radius"
          pointAltitude="altitude"
          pointColor="pointColor"
          pointLabel={(d: any) => farmInfo(d.farm)}
          onPointClick={(point) => { onPointClick(point) }}
          onPointRightClick={() => (globeEl.current?.controls() as any).autoRotate = false}
          onPointHover={() => (globeEl.current?.controls() as any).autoRotate = true}

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

  const farmInfo = (farm: IFarm) => {
    const pendingBlocks = getPendingBlocksAmount(farm);
    const unbondingBlocks = Math.floor(farm.deposit.unbondingBlocks * unbondingBlocksFactor);

    return ReactDOMServer.renderToString((
      <div className="moontip">
        <span>{`${resources.MOON_FARM_DATA}`}</span>
        <p>{`${resources.FARMING_OVERVIEW.ACCOUNT.TITLE}: ${farm.account}`}</p>
        <p>{`${resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE}: ${farm.deposit.blockNumber}`}</p>
        <p>{`${resources.FARMING_SUMMARY.CREATED.TITLE}: ${farm.created.toLocaleString()}`}</p>
        <p>{`${resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE}: ${scaleDownUnits(farm.deposit.amount).toLocaleString()}`}</p>
        <p>{`${resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE}: ${pendingBlocks} (${blocksDurationText(pendingBlocks)})`}</p>
        <p>{`${resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE}: ${unbondingBlocks} (${blocksDurationText(unbondingBlocks)})`}</p>
        <p>{`${resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE}: ${farm.vestimatedApy}`}%</p>
        <p>{`${resources.FARMING_SUMMARY.MULTIPLIER.TITLE}: ${farm.deposit.multiplier / 1000}`}</p>
        <p>{`${resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE}: ${scaleDownUnits(farm.reward).toLocaleString()}`}</p>
      </div>
    ));
  }

  const showMoonFarm = (account: any) => {
    (globeEl as any).current.pointOfView(getFarmPoint(account), 2000);
    (globeRef as any).current.scrollIntoView({ behavior: 'smooth' });
  }

  const getFarmPoint = (account: string): ICoordinates => {
    const addressParts = account.match(/.{1,22}/g) as RegExpMatchArray;
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
        const targetRing = {
          lat: Number(point.lat),
          lng: Number(point.lng),
          ringColor: 'orange',
          maxRadius: 5,
          propagationSpeed: 5,
          repeatPeriod: FLIGHT_TIME * ARC_REL_LEN / 3,
          radius: undefined,
          altitude: undefined,
          pointColor: undefined,
          farm: undefined
        };
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
          {farmingOverview.map((farm: IFarm) => {
            const amount = scaleDownUnits(farm.deposit.amount);
            const pendingBlocks = getPendingBlocksAmount(farm);
            const unbondingBlocks = Math.floor(farm.deposit.unbondingBlocks * unbondingBlocksFactor);

            return (
              <div role="row" key={farm.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_OVERVIEW.ACCOUNT.TITLE + ":"} className="tw-border-l-0 tw-cursor-pointer wider" onClick={() => showMoonFarm(farm.account)}>{farm.account}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} className="tw-border-l-0 narrow">{farm.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ":"} className="narrow" title={farm.created.toLocaleTimeString()}>{farm.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"} >{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} className="narrow" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} className="narrow" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} className="narrow">{farm.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} className="narrow">{farm.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"} className="wide">{scaleDownUnits(farm.reward).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const subtitle1 = 'All moon farms.';
  const subtitle2 = 'One single view.';

  if (!web3) {
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
                  <div className="tw-overflow-x-auto tw-text-secondary tw-my-5 ">{renderFarmingOverviewTable(farmingOverview)}</div>
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
            <h1>{helpData?.helpTitle}</h1>
            <p>{helpData?.helpInfo}</p>
            <br />
            <p>{helpData?.helpDetails}</p>
          </Modal>
        </div>
      </div>
    </div>
  );

  //#endregion
}

MoonControl.displayName = MoonControl.name;
export default MoonControl;
