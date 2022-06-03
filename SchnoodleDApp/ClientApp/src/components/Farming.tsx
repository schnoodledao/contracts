// ReSharper disable InconsistentNaming
import React, { useState, useRef, useEffect } from 'react';
import { general, farming as resources } from '../resources';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import SchnoodleFarmingV1 from '../contracts/SchnoodleFarmingV1.json';
import SchnoodleFarming from '../contracts/SchnoodleFarmingV2.json';
import { initializeHelpers, handleError, getWeb3, scaleDownUnits, scaleUpUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks } from '../helpers';
import { IStatus, IHelpData } from '../types';

// Third-party libraries
import { debounce, range } from 'lodash';
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import Plot from 'react-plotly.js';
import { Puff } from 'react-loader-spinner';
const bigInt = require('big-integer');
// ReSharper restore InconsistentNaming

interface IAmountData {
  depositAmount: number,
  availableAmount: number,
  withdrawAmounts: number[]
}

interface IBalanceData {
  farmingFundBalance: number,
  balance: number,
  lockedBalance: number,
  unbondingBalance: number,
}

interface IContractData {
    web3: any,
    schnoodle: any,
    schnoodleFarming: any,
    selectedAddress: string
}

interface IFactorData {
    factoredVestingBlocks: number,
    factoredVestingBlocksMax: number
    factoredUnbondingBlocks: number,
    factoredUnbondingBlocksMax: number,
    vestingBlocksFactor: number,
    unbondingBlocksFactor: number,
}

interface IOptimumData {
  optimumVestingBlocks: number,
  optimumUnbondingBlocks: number
}

interface IPlotData {
  type: string,
  opacity: number,
  color: string,
  x: number[],
  y: number[],
  z: number[]
}

interface IProgress {
  vestiplotProgress: number
}

interface IRewardData {
    vestimatedReward: number,
    vestimatedApy: number
}

interface IRateData {
    operativeFeeRate: number,
    donationRate: number,
    sowRate: number,
    sellQuota: { blockMetric: number, amount: number }
}

interface ISummaryData {
    unbondingSummary: any[],
    farmingSummary: any[]
}

interface IVestiplotData {
  vestiplotReward: IPlotData[],
  vestiplotApy: IPlotData[]
}

const Farming: React.FC<{}> = () => {
  const [vestiplotsCancellationToken, setVestiplotsCancellationToken] = useState<Symbol>();
  const [contracts, setContracts] = useState<IContractData>();
  const [blockNumber, setBlockNumber] = useState<number>();
  const [factors, setFactors] = useState<IFactorData>({
    factoredVestingBlocks: 0,
    vestingBlocksFactor: 0,
    factoredVestingBlocksMax: 0,
    factoredUnbondingBlocks: 0,
    unbondingBlocksFactor: 0,
    factoredUnbondingBlocksMax: 0
  });
  const [rewards, setRewards] = useState<IRewardData>({
    vestimatedReward: 0,
    vestimatedApy: 0
  });
  const [optimum, setOptimum] = useState<IOptimumData>({
    optimumVestingBlocks: 0,
    optimumUnbondingBlocks: 0
  });
  const [progress, setProgress] = useState<IProgress>();
  const [vestiplot, setVestiplot] = useState<IVestiplotData>({
    vestiplotReward: [],
    vestiplotApy: []
  });
  const [openModal, setOpenHelpModal] = useState(false);
  const [helpData, setHelpData] = useState<IHelpData>({
    helpTitle: "",
    helpInfo: "",
    helpDetails: "",
  });
  const [rates, setRates] = useState<IRateData>({
    operativeFeeRate: 0,
    donationRate: 0,
    sowRate: 0,
    sellQuota: { blockMetric: 0, amount: 0 }
  });
  const [balances, setBalances] = useState<IBalanceData>({
    farmingFundBalance: 0,
    balance: 0,
    lockedBalance: 0,
    unbondingBalance: 0
  });
  const [summaries, setSummaries] = useState<ISummaryData>({
    farmingSummary: [],
    unbondingSummary: []
  });
  const [status, setStatus] = useState<IStatus>();
  const [amounts, setAmounts] = useState<IAmountData>({
    depositAmount: 0,
    availableAmount: 0,
    withdrawAmounts: [0]
  });
  const [getInfoIntervalId, setGetInfoIntervalId] = useState<NodeJS.Timer | undefined>();
  const savedCallback = useRef<any>(updateVestimates);
  const savedVestiplots = useRef<any>(updateVestimates);
  savedCallback.current = debounce(updateVestimates, 500);
  savedVestiplots.current = debounce(updateVestiplots, 2000);

  useEffect(() => {
    if (!contracts) return
    const { schnoodle, selectedAddress, schnoodleFarming } = contracts;
    const fetchData = async () => {
      getInfo();
      const getInfoIntervalId = setInterval(async () => await getInfo(), 10000);
      setGetInfoIntervalId(getInfoIntervalId);
      const operativeFeeRate = await schnoodle.methods.getOperativeFeeRate().call();
      const { 1: donationRate } = await schnoodle.methods.getEleemosynaryDetails().call();
      const sowRate = await schnoodle.methods.getSowRate().call();
      const sellQuota = await schnoodle.methods.getSellQuota().call();
      // const farmingFundBalance = bigInt(await schnoodle.methods.balanceOf(await schnoodle.methods.getFarmingFund().call()).call());
      const farmingFundBalance = 10000;
      const balance = bigInt(await schnoodle.methods.balanceOf(selectedAddress).call());
      const lockedBalance = bigInt(await schnoodleFarming.methods.lockedBalanceOf(selectedAddress).call());
      const unbondingBalance = bigInt(await schnoodleFarming.methods.unbondingBalanceOf(selectedAddress).call());
      const availableAmount = bigInt(await schnoodle.methods.unlockedBalanceOf(selectedAddress).call());
      const vestingBlocksFactor = await schnoodleFarming.methods.getVestingBlocksFactor().call() / 1000;
      const unbondingBlocksFactor = await schnoodleFarming.methods.getUnbondingBlocksFactor().call() / 1000;
      const factoredVestingBlocksMax = Math.floor(blocksPerDuration({ years: 1 }) * vestingBlocksFactor);
      const factoredUnbondingBlocksMax = Math.floor(await schnoodleFarming.methods.getMaxUnbondingBlocks().call() * unbondingBlocksFactor);

      // Fetch the farming summary while also calculating the APY for each deposit
      const farmingSummary = await Promise.all([].concat(await schnoodleFarming.methods.getFarmingSummary(selectedAddress).call()).sort((a: any, b: any) => a.deposit.blockNumber > b.deposit.blockNumber ? 1 : -1).map(async (depositReward: any) => {
      const deposit = depositReward.deposit;
      const rewardBlock = Math.max(parseInt(deposit.blockNumber) + parseInt(deposit.vestingBlocks), blockNumber);
      const vestimatedApy = await calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(selectedAddress, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber);
      const created = new Date((await contracts.web3.eth.getBlock(deposit.blockNumber)).timestamp * 1000);
      return { deposit: deposit, created: created, reward: bigInt(depositReward.reward), vestimatedApy: vestimatedApy };
      }));

      const unbondingSummary = [].concat(await schnoodleFarming.methods.getUnbondingSummary(selectedAddress).call()).sort((a: any, b: any) => a.expiryBlock > b.expiryBlock ? 1 : -1);

      const withdrawAmounts = [];
      for (let i = 0; i < farmingSummary.length; i++) {
          const withdrawAmount = amounts.withdrawAmounts[i];
          withdrawAmounts[i] = amounts.withdrawAmounts[i] === undefined ? scaleDownUnits(farmingSummary[i].deposit.amount) : withdrawAmount;
      }
      setFactors({...factors, vestingBlocksFactor: vestingBlocksFactor, factoredVestingBlocksMax: factoredVestingBlocksMax,
                  unbondingBlocksFactor: unbondingBlocksFactor, factoredUnbondingBlocksMax: factoredUnbondingBlocksMax})
      setAmounts({...amounts, availableAmount: availableAmount, withdrawAmounts: withdrawAmounts})
      setRates({operativeFeeRate, donationRate, sowRate, sellQuota})
      setBalances({farmingFundBalance: farmingFundBalance, balance: balance,
                  lockedBalance: lockedBalance, unbondingBalance: unbondingBalance});
      setSummaries({farmingSummary, unbondingSummary})
    }
    fetchData();
  }, [contracts])

  useEffect(() => {
    try {
      const fetchData = async () => {
        const web3: any = await getWeb3();
        const schnoodleDeployedNetwork = (SchnoodleV1 as any).networks[await web3.eth.net.getId()];
        const schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleDeployedNetwork && schnoodleDeployedNetwork.address);
        const schnoodleFarmingDeployedNetwork = (SchnoodleFarmingV1 as any).networks[await web3.eth.net.getId()];
        const schnoodleFarming = new web3.eth.Contract(SchnoodleFarming.abi, schnoodleFarmingDeployedNetwork && schnoodleFarmingDeployedNetwork.address);
        await initializeHelpers(await schnoodle.methods.decimals().call());

        (window as any).ethereum.on('networkChanged', () => window.location.reload());

        setContracts({ web3, schnoodle, schnoodleFarming, selectedAddress: web3.currentProvider.selectedAddress })
      }
      fetchData();
    } catch (err) {
      handleError(err, setStatus);
    }
    return () => {
        clearInterval(getInfoIntervalId as NodeJS.Timer);
        savedCallback.current.cancel();
        savedVestiplots.current.cancel();
    }
  }, [])

  useEffect(() => {
    if (factors) {
      updateVestimates();
    }
  }, [factors])

  useEffect(() => {
    if (amounts) {
      updateVestimates();
      updateVestiplots();
    }
  }, [amounts])

  const getInfo = async () => {
    const blockNumber = await contracts.web3.eth.getBlockNumber();
    setBlockNumber(blockNumber);
  }

  //#region Handling

  const handleReceipt = async (receipt: any) => {
    setStatus({ success: receipt.status, message: receipt.transactionHash });
    await getInfo();
  }

  //#endregion

  //#region Deposit functions

  const addDeposit = async () => {
    try {
      const { schnoodleFarming, selectedAddress } = contracts;
      const { depositAmount, availableAmount } = amounts;

      const depositAmountValue = preventDust(depositAmount, availableAmount);
      const receipt = await schnoodleFarming.methods.addDeposit(depositAmountValue.toString(), vestingBlocks(), unbondingBlocks()).send({ from: selectedAddress });
      await handleReceipt(receipt);
    } catch (err) {
      await handleError(err, setStatus);
    }
  }

  const withdraw = async (i: number) => {
    try {
      const { schnoodleFarming, selectedAddress } = contracts;

      const depositInfo = summaries.farmingSummary[i];
      const amountToWithdraw = preventDust(amounts.withdrawAmounts[i], depositInfo.deposit.amount);
      const receipt = await schnoodleFarming.methods.withdraw(depositInfo.deposit.id, amountToWithdraw.toString()).send({ from: selectedAddress });
      await handleReceipt(receipt);
    } catch (err) {
      await handleError(err, setStatus);
    }
  }

  const preventDust = (userAmount: number, maxAmount: number) => {
    return userAmount === scaleDownUnits(maxAmount) ? maxAmount : scaleUpUnits(userAmount);
  }

  //#endregion

  //#region Withdraw amount functions

  const updateWithdrawAmount = (index: number, e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    const { withdrawAmounts } = amounts;
    withdrawAmounts[index] = Math.min(value, scaleDownUnits(summaries.farmingSummary[index].deposit.amount));
    setAmounts({ ...amounts, withdrawAmounts: withdrawAmounts });
  }

  const maxWithdraw = async (index: number) => {
    const { withdrawAmounts } = amounts;
    withdrawAmounts[index] = scaleDownUnits(summaries.farmingSummary[index].deposit.amount);
    setAmounts({ ...amounts, withdrawAmounts: withdrawAmounts });
  }

  //#endregion

  //#region Deposit amount functions

  const updateDepositAmount = async (e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setDepositAmount(value);
  }

  const setDepositAmount = async (amount: number) => {
    setAmounts({...amounts, depositAmount: Math.min(Math.floor(amount), scaleDownUnits(amounts.availableAmount))})
  }

  //#endregion

  //#region Vesting blocks functions

  const vestingBlocks = () => {
    if (!factors) return 0
    const { factoredVestingBlocks, vestingBlocksFactor } = factors;
    return factoredVestingBlocks / vestingBlocksFactor;
  }

  const updateVestingBlocks = async (e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setFactors({...factors, factoredVestingBlocks: Math.min(value, factors.factoredVestingBlocksMax) })
  }

  const addVestingBlocks = async (blocks: any) => {
    const { factoredVestingBlocks, factoredVestingBlocksMax } = factors;
    setFactors({...factors, factoredVestingBlocks: Math.min(factoredVestingBlocks + blocks, factoredVestingBlocksMax) })
  }

  const maxVestingBlocks = async () => {
    setFactors({...factors, factoredVestingBlocks: factors.factoredVestingBlocksMax })
  }

  //#endregion

  //#region Unbonding blocks functions

  const unbondingBlocks = () => {
    const { factoredUnbondingBlocks, unbondingBlocksFactor } = factors;
    return factoredUnbondingBlocks / unbondingBlocksFactor;
  }

  const updateUnbondingBlocks = async (e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setFactors({ ...factors, factoredUnbondingBlocks: Math.min(value, factors.factoredUnbondingBlocksMax)})
  }

  const addUnbondingBlocks =  async (blocks: number) => {
    const { factoredUnbondingBlocks, factoredUnbondingBlocksMax } = factors;
    setFactors({...factors, factoredUnbondingBlocks: Math.min(factoredUnbondingBlocks + blocks, factoredUnbondingBlocksMax)})
  }

  const maxUnbondingBlocks = async () => {
    setFactors({...factors, factoredUnbondingBlocks: factors.factoredUnbondingBlocksMax })
  }

  //#endregion

  //#region Vestimates / Vestiplots

  async function updateVestimates () {
    const [vestimatedReward, vestimatedApy] = await getVestimates(amounts.depositAmount, vestingBlocks(), unbondingBlocks());
    setRewards({ vestimatedReward: vestimatedReward, vestimatedApy: vestimatedApy });
  }

  async function updateVestiplots () {
    const { factoredVestingBlocksMax, factoredUnbondingBlocksMax, vestingBlocksFactor, unbondingBlocksFactor } = factors;
    const { depositAmount } = amounts;
    setVestiplotsCancellationToken(Symbol());
    const token = vestiplotsCancellationToken;
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
    setOptimum({ optimumVestingBlocks, optimumUnbondingBlocks });
    if (depositAmount > 0) {
      const steps = vestingBlocksList.length * unbondingBlocksList.length;
      let maxVestimatedApy = 0;
      let vestiplotProgress = 0;

      for (const vestingBlocksItem of vestingBlocksList) {
        for (const unbondingBlocksItem of unbondingBlocksList) {
          if (token !== vestiplotsCancellationToken) return;

          const [vestimatedReward, vestimatedApy] = await getVestimates(depositAmount, vestingBlocksItem / vestingBlocksFactor, unbondingBlocksItem / unbondingBlocksFactor);

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
          setProgress({ vestiplotProgress: Math.floor(100 * ++vestiplotProgress / steps) });
        }
      }
    } else {
      return;
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

    setOptimum({optimumVestingBlocks, optimumUnbondingBlocks})
    setVestiplot({ vestiplotReward: vestiplotReward, vestiplotApy: vestiplotApy});
  }

  const maximiseApy = async () => {
    setFactors({ ...factors, factoredVestingBlocks: optimum.optimumVestingBlocks, factoredUnbondingBlocks: optimum.optimumUnbondingBlocks })
  }

  const getVestimates = async (amount: number, vestingBlocks: number, unbondingBlocks: number) => {
    if (amount === 0 || vestingBlocks === 0 || unbondingBlocks === 0) {
      return [0, 0];
    }
    const vestimatedReward = scaleDownUnits(await contracts.schnoodleFarming.methods.getReward(scaleUpUnits(amount).toString(), vestingBlocks, unbondingBlocks, blockNumber + vestingBlocks).call());
    const vestimatedApy = await calculateApy(amount, vestimatedReward, vestingBlocks);

    return [vestimatedReward, vestimatedApy];
  }

  //#endregion

  //#region Help functions

  const openHelpModal = (content: any) => {
    setOpenHelpModal(true);
    setHelpData({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS });
  }

  const closeHelpModal = () => {
    setOpenHelpModal(false);
  }

  //#endregion

  //#region Rendering

  const renderFarmingSummaryTable = (farmingSummary: any) => {
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
            <span role="columnheader" className="narrower">
              {blockNumberTitleParts[0]}<br />{blockNumberTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.BLOCK_NUMBER)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrower">
              {resources.FARMING_SUMMARY.CREATED.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.CREATED)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {depositAmountTitleParts[0]}<br />{depositAmountTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.DEPOSIT_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrower">
              {pendingBlocksTitleParts[0]}<br />{pendingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.PENDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrower">
              {unbondingBlocksTitleParts[0]}<br />{unbondingBlocksTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.UNBONDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrower">
              {vestimatedApyTitleParts[0]}<br />{vestimatedApyTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.VESTIMATED_APY)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="narrow">
              {resources.FARMING_SUMMARY.MULTIPLIER.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.MULTIPLIER)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {currentRewardTitleParts[0]}<br />{currentRewardTitleParts[1]}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.CURRENT_REWARD)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="wider">
              {resources.FARMING_SUMMARY.WITHDRAW.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_SUMMARY.WITHDRAW)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" className="tw-text-secondary">
          {farmingSummary?.map((depositInfo: any, i: number) => {
            const amount = scaleDownUnits(depositInfo.deposit.amount);
            const pendingBlocks = getPendingBlocks(Math.floor(depositInfo.deposit.vestingBlocks * factors.vestingBlocksFactor), depositInfo.deposit.blockNumber, blockNumber);
            const unbondingBlocks = Math.floor(depositInfo.deposit.unbondingBlocks * factors.unbondingBlocksFactor);

            return (
              <div role="row" key={depositInfo.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ":"} className="tw-border-l-0 narrower">{depositInfo.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ":"} className="narrower" title={depositInfo.created.toLocaleTimeString()}>{depositInfo.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ":"}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ":"} className="narrower" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ":"} className="narrower" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ":"} className="narrower" >{depositInfo.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ":"} className="narrow" >{depositInfo.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ":"}>{scaleDownUnits(depositInfo.reward).toLocaleString()}</span>
                <span role="cell" className="wider">
                  <form>
                    <fieldset disabled={pendingBlocks > 0}>
                      <div className="tw-relative">
                        <div className="tw-flex">
                          <input type="number" min="1" max={amount} value={amounts.withdrawAmounts[i] || ''} onChange={(e) => updateWithdrawAmount(i, e)} className="withdrawinput" />
                          <button type="button" onClick={() => maxWithdraw(i)} className="maxwithdraw">Max</button>
                          <button type="button" className="withdrawbtn" disabled={amounts.withdrawAmounts[i] < 1 || amounts.withdrawAmounts[i] > amount} onClick={() => withdraw(i)}><span>Withdraw</span></button>
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

  const renderUnbondingSummaryTable = (unbondingSummary: any) => {
    return (
      <div role="table" aria-label={resources.UNBONDING_SUMMARY.TITLE} className="border-secondary border-4 rounded-2xl text-accent-content">
        <div role="rowgroup" className="columnheader-group">
          <div role="row">
            <span role="columnheader" className="">
              {resources.UNBONDING_SUMMARY.AMOUNT.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.UNBONDING_SUMMARY.AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader" className="">
              {resources.UNBONDING_SUMMARY.PENDING_BLOCKS.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.UNBONDING_SUMMARY.PENDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
            <span role="columnheader">
              {resources.UNBONDING_SUMMARY.TIME_REMAINING.TITLE}
              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.UNBONDING_SUMMARY.TIME_REMAINING)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
            </span>
          </div>
        </div>
        <div role="rowgroup" className="tw-text-secondary">
          {unbondingSummary.map((unbond: any) => {
            const amount = scaleDownUnits(unbond.amount);
            const pendingBlocks = parseInt(unbond.expiryBlock) - blockNumber;
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

  const token = 'SNOOD';
  const subtitle1 = 'Advanced yield farming.';
  const subtitle2 = 'But on the moon.';
  
  if(!contracts?.web3){
    return (
    <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
        <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
            <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
            <div className="maintitles tw-uppercase">{resources.MOON_FARMING}</div>
            <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
            <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{general.LOADING}<span>.</span><span>.</span><span>.</span></p>
            <div className="tw-px-4 tw-mt-4 fakebutton">&nbsp;</div>
            </div>
        </div>
        </div>
    </div>
    )
  }
    return (
      <div className="farming tw-w-100">
        <div className="tw-m-auto tw-px-4 tw-max-w-screen-2xl">
          <div className="h-noheader tw-overflow-hidden tw-bg-neutral-focus tw-mx-2 md:tw-m-auto tw-font-roboto">
            <div className="tw-text-center tw-px-1 md:tw-px-4">
              <div className="tw-text-base-200 tw-w-full">
                <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.MOON_FARMING}</h1>
                <p className="tw-my-2 tw-text-2xl md:tw-text-3xl tw-leading-tight titlefont tw-w-2/3 md:tw-w-full tw-m-auto md:tw-mx-0 textfade tw-from-green-400 tw-to-purple-500">
                  <span className="tw-block md:tw-hidden tw-text-center">{subtitle1}<br />{subtitle2}</span>
                  <span className="tw-hidden md:tw-block tw-text-left">{subtitle1} {subtitle2}</span>
                </p>
                <div className="tw-stats stats topstats">
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.BLOCK_NUMBER.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.BLOCK_NUMBER)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{blockNumber}</div>
                    <div className="tw-stat-desc">&nbsp;</div>
                  </div>
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.SELL_QUOTA.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.SELL_QUOTA)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{scaleDownUnits(rates.sellQuota.amount).toLocaleString()}</div>
                    <div className="tw-stat-desc">{token} since {new Date(rates.sellQuota.blockMetric * 1000).toLocaleString()}</div>
                  </div>
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.FARMING_FUND_BALANCE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_FUND_BALANCE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{scaleDownUnits(balances.farmingFundBalance).toLocaleString()}</div>
                    <div className="tw-stat-desc">{token}</div>
                  </div>
                </div>

                <div className="tw-stats stats topstats">
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.OPERATIVE_FEE_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.OPERATIVE_FEE_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{rates.operativeFeeRate / 10}</div>
                    <div className="tw-stat-desc">%</div>
                  </div>
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.ELEEMOSYNARY_DONATION_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.ELEEMOSYNARY_DONATION_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{rates.donationRate / 10 ?? 0}</div>
                    <div className="tw-stat-desc">%</div>
                  </div>
                  <div className="tw-stat">
                    <div className="tw-stat-title">
                      {resources.FARMING_FUND_SOW_RATE.TITLE}
                      <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_FUND_SOW_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                    </div>
                    <div className="tw-stat-value greenfade">{rates.sowRate / 10}</div>
                    <div className="tw-stat-desc">%</div>
                  </div>
                </div>

                <div className="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
                  <div className="tw-card-body tw-my-6 md:tw-my-10 tw-rounded-4xl">
                    <h2 className="tw-card-title headingfont tw-text-purple-500"><span className="purplefade">Your {token} Tokens</span></h2>
                    <div className="tw-shadow-sm bottomstats tw-stats stats">
                      <div className="tw-stat tw-border-t-0">
                        <div className="tw-stat-title">
                          {resources.TOTAL_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.TOTAL_BALANCE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div className="tw-stat-value purplefade">{scaleDownUnits(balances.balance).toLocaleString()}</div>
                        <div className="tw-stat-desc">{token}</div>
                      </div>
                      <div className="tw-stat">
                        <div className="tw-stat-title">
                          {resources.LOCKED_BALANCE.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.LOCKED_BALANCE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div className="tw-stat-value purplefade">{scaleDownUnits(balances.lockedBalance).toLocaleString()}</div>
                        <div className="tw-stat-desc">{token}{scaleDownUnits(balances.unbondingBalance) > 0 && (<span className="opacity-60 text-xs"><br />{scaleDownUnits(balances.unbondingBalance).toLocaleString()} unbonding</span>)}</div>
                      </div>
                      <div className="tw-stat">
                        <div className="tw-stat-title">
                          {resources.AVAILABLE_AMOUNT.TITLE}
                          <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.AVAILABLE_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                        </div>
                        <div className="tw-stat-value purplefade">{scaleDownUnits(amounts.availableAmount)}</div>
                        <div className="tw-stat-desc">{token}</div>
                      </div>
                    </div>

                    <div className="tw-divider tw-mt-10">
                      <h3 className="sectiontitle tw-text-2xl md:tw-text-3xl tw-leading-tight">{resources.ADD_DEPOSIT}</h3>
                    </div>

                    <div className="tw-card-actions tw-text-center tw-mx-auto tw-w-full">
                      <form className="tw-justify-center fullhalfwidth tw-mx-auto tw-mt-5">
                        <fieldset disabled={amounts.availableAmount === 0}>
                          <div className="tw-form-control">
                            <div>
                              <label className="tw-label">
                                <span className="tw-label-text">
                                  {resources.DEPOSIT_AMOUNT.TITLE}
                                  <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.DEPOSIT_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                                </span>
                              </label>
                              <div className="tw-relative tw-flex">
                                <input type="number" min="1" max={scaleDownUnits(amounts.availableAmount)} placeholder={'Max: ' + scaleDownUnits(amounts.availableAmount)} value={amounts.depositAmount || ''} onChange={updateDepositAmount} className="depositinput" />
                                <button type="button" className="dwmbutton hidesmmd" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount / 4))}>25%</button>
                                <button type="button" className="dwmbutton hidesmmd" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount/ 2))}>50%</button>
                                <button type="button" className="dwmbutton hidesmmd" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount * 3 / 4))}>75%</button>
                                <button type="button" className="dwmbutton hidelg" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount / 4))}>&frac14;</button>
                                <button type="button" className="dwmbutton hidelg" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount / 2))}>&frac12;</button>
                                <button type="button" className="dwmbutton hidelg" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount * 3 / 4))}>&frac34;</button>
                                <button type="button" className="maxbuttons" onClick={() => setDepositAmount(scaleDownUnits(amounts.availableAmount))}>Max</button>
                              </div>
                            </div>
                          </div>
                          <div className="tw-mb-3 tw-form-control nobutton">
                            <label className="tw-label">
                              <span className="tw-label-text">
                                {resources.VESTING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.VESTING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </span>
                            </label>
                            <div className="tw-mb-3 tw-flex">
                              <input type="number" min="1" max={factors.factoredVestingBlocksMax} placeholder={'Max: ' + factors.factoredVestingBlocksMax} value={factors.factoredVestingBlocks} onChange={updateVestingBlocks} className="depositinput w-full" />
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ weeks: 1 }))}>Week</button>
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ months: 1 }))}>Month</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ weeks: 1 }))} title="Week">W</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ months: 1 }))} title="Month">M</button>
                              <button type="button" className="maxbuttons" onClick={maxVestingBlocks}>Max</button>
                            </div>
                            <p className="approxLabel">{blocksDurationText(factors.factoredVestingBlocks)}</p>
                          </div>
                          <div className="tw-mb-3 tw-form-control nobutton">
                            <label className="tw-label">
                              <span className="tw-label-text">
                                {resources.UNBONDING_BLOCKS.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() =>openHelpModal(resources.UNBONDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer tw-minustop" />
                              </span>
                            </label>
                            <div className="tw-mb-3 tw-flex">
                              <input type="number" min="1" max={factors.factoredUnbondingBlocksMax} placeholder={'Max: ' + factors.factoredUnbondingBlocksMax} value={factors.factoredUnbondingBlocks || ''} onChange={updateUnbondingBlocks} className="depositinput" />
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))}>Minute</button>
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ hours: 1 }))}>Hour</button>
                              <button type="button" className="dwmbutton hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))} title="Minute">M</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ hours: 1 }))} title="Hour">H</button>
                              <button type="button" className="dwmbutton hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                              <button type="button" className="maxbuttons" onClick={maxUnbondingBlocks}>Max</button>
                            </div>
                            <p className="approxLabel">{blocksDurationText(factors.factoredUnbondingBlocks)}</p>
                          </div>
                          <div className="tw-mb-3 tw-form-control">
                            <button type="button" className="keybtn maxbuttons maximise" disabled={optimum.optimumVestingBlocks === 0 || optimum.optimumVestingBlocks === 0} onClick={maximiseApy}>Maximise APY</button>
                          </div>
                          <div className="tw-shadow-sm bottomstats tw-stats stats">
                            <div className="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                              <div className="tw-stat-title">
                                {resources.VESTIMATED_REWARD.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.VESTIMATED_REWARD)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </div>
                              <div className="tw-stat-value tw-text-accent">{rewards.vestimatedReward.toLocaleString()}</div>
                              <div className="tw-stat-desc">{token}</div>
                            </div>
                            <div className="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                              <div className="tw-stat-title">
                                {resources.VESTIMATED_APY.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.VESTIMATED_APY)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </div>
                              <div className="tw-stat-value tw-text-accent">{rewards.vestimatedApy}</div>
                              <div className="tw-stat-desc">%</div>
                            </div>
                          </div>
                          <div className="tw-mb-3 tw-form-control">
                            <button type="button" className="keybtn maxbuttons" disabled={amounts.depositAmount < 1 || vestingBlocks() < 1 || unbondingBlocks() < 1 || amounts.depositAmount > amounts.availableAmount} onClick={addDeposit}>Deposit</button>
                          </div>
                        </fieldset>
                      </form>
                    </div>
                    <div className="tw-grid tw-mt-4">
                      {progress?.vestiplotProgress > 0 && progress?.vestiplotProgress < 100 &&
                        <div className="tw-overlay tw-z-20">
                          <div className="overlayloader tw-flex tw-flex-col tw-items-center tw-justify-center ">
                            <div>
                              {/* @ts-ignore */}
                              <Puff type="Puff" color="#00BFFF" />
                            </div>
                            <div>
                              <p className="approxLabel tw-mt-4">{progress.vestiplotProgress}%</p>
                            </div>
                          </div>
                        </div>
                      }
                      
                      <div className="plotcontainer tw-z-10">
                        <div className="tw-flex tw-flex-col xl:tw-flex-row">

                          {vestiplot.vestiplotReward.length > 0 &&
                            <Plot
                              data={vestiplot.vestiplotReward as any}
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
                          }

                          {vestiplot.vestiplotApy.length > 0 &&
                            <Plot
                              data={vestiplot.vestiplotApy as any}
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
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {summaries?.farmingSummary.length > 0 &&
                  <div className="summarytable">
                    <h3 className="tw-mb-5 headingfont sectiontitle tw-mt-10">{resources.FARMING_SUMMARY.TITLE}</h3>
                    <div className="tw-overflow-x-auto tw-text-secondary tw-my-5">
                      {renderFarmingSummaryTable(summaries.farmingSummary)}
                    </div>
                  </div>
                }

                {summaries?.unbondingSummary.length > 0 && summaries.unbondingSummary.some((u: any) => parseInt(u.expiryBlock) - blockNumber > 0) &&
                  <div className="summarytable">
                    <h3 className="tw-mb-5 tw-headingfont tw-sectiontitle tw-mt-10">{resources.UNBONDING_SUMMARY.TITLE}</h3>
                    <div className="tw-overflow-x-auto tw-text-secondary tw-my-5">
                      {renderUnbondingSummaryTable(summaries.unbondingSummary)}
                    </div>
                  </div>
                }

                <div className="my-5">
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
  }

  //#endregion

Farming.displayName = Farming.name;
export default Farming;