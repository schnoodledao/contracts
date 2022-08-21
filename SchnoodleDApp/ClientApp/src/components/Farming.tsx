// ReSharper disable InconsistentNaming
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { general, farming as resources } from '../resources';
import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import SchnoodleFarmingV1 from '../contracts/SchnoodleFarmingV1.json';
import SchnoodleFarming from '../contracts/SchnoodleFarmingV2.json';
import { initializeHelpers, handleError, getWeb3, scaleDownUnits, scaleUpUnits, calculateApy, blocksPerDuration, blocksDurationText, getPendingBlocks, useDebounce } from '../helpers';
import { IStatus, IHelpData } from '../types';

// Third-party libraries
import { range } from 'lodash-es';
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import Plot from 'react-plotly.js';
import { Puff } from 'react-loader-spinner';
import { Contract } from 'web3-eth-contract';
// ReSharper restore InconsistentNaming

interface IDeposit {
  id: number,
  amount: bigint,
  blockNumber: number,
  vestingBlocks: number,
  unbondingBlocks: number,
  multiplier: number,
}

interface IFarm {
  deposit: IDeposit,
  created: Date,
  reward: bigint,
  vestimatedApy: number,
}

interface IUnbond {
  amount: bigint,
  expiryBlock: number,
}

interface IPlotData {
  type: string,
  opacity: number,
  color: string,
  x: number[],
  y: number[],
  z: number[],
}

interface ISellQuota {
  blockMetric: number,
  amount: bigint,
}

const Farming: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [schnoodle, setSchnoodle] = useState<Contract>();
  const [schnoodleFarming, setSchnoodleFarming] = useState<Contract>();
  const [blockNumber, setBlockNumber] = useState(0);
  const [operativeFeeRate, setOperativeFeeRate] = useState(0);
  const [donationRate, setDonationRate] = useState(0);
  const [sowRate, setSowRate] = useState(0);
  const [sellQuota, setSellQuota] = useState<ISellQuota>({ amount: 0n, blockMetric: 0 });
  const [farmingFundBalance, setFarmingFundBalance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [lockedBalance, setLockedBalance] = useState<bigint>(0n);
  const [unbondingBalance, setUnbondingBalance] = useState<bigint>(0n);
  const [availableAmount, setAvailableAmount] = useState<bigint>(0n);
  const [vestingBlocksFactor, setVestingBlocksFactor] = useState(0);
  const [unbondingBlocksFactor, setUnbondingBlocksFactor] = useState(0);
  const [factoredVestingBlocks, setFactoredVestingBlocks] = useState(0);
  const [factoredVestingBlocksMax, setFactoredVestingBlocksMax] = useState(0);
  const [factoredUnbondingBlocks, setFactoredUnbondingBlocks] = useState(0);
  const [factoredUnbondingBlocksMax, setFactoredUnbondingBlocksMax] = useState(0);
  const [farmingSummary, setFarmingSummary] = useState<IFarm[]>([]);
  const [unbondingSummary, setUnbondingSummary] = useState<IUnbond[]>([]);

  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawAmounts, setWithdrawAmounts] = useState<number[]>([]);
  const [optimumVestingBlocks, setOptimumVestingBlocks] = useState(0);
  const [optimumUnbondingBlocks, setOptimumUnbondingBlocks] = useState(0);

  const [vestimatedReward, setVestimatedReward] = useState(0);
  const [vestimatedApy, setVestimatedApy] = useState(0);
  const [vestiplotReward, setVestiplotReward] = useState<IPlotData[]>();
  const [vestiplotApy, setVestiplotApy] = useState<IPlotData[]>();
  const [vestiplotProgress, setVestiplotProgress] = useState(0);

  const [openModal, setOpenHelpModal] = useState(false);
  const [helpData, setHelpData] = useState<IHelpData>();
  const [status, setStatus] = useState<IStatus>({ success: true, message: null });

  function useCancelToken(): any {
    const token = useRef({ cancelled: false });
    const cancel = () => token.current.cancelled = true;
    return [token.current, cancel];
  }

  const [vestiplotsCancellationToken, setVestiplotsCancellationToken] = useCancelToken();

  const web3 = getWeb3();
  const selectedAddress = web3.currentProvider.selectedAddress;

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
  }, []);

  useEffect(() => {
    if (!initialized) {
      (async function getInfo() {
        if (!schnoodle || !schnoodleFarming) return;
        setInitialized(true);

        const blockNumber = await web3.eth.getBlockNumber();
        const sellQuota = await schnoodle.methods.getSellQuota().call();

        setBlockNumber(blockNumber);
        setOperativeFeeRate(Number(await schnoodle.methods.getOperativeFeeRate().call()));
        setDonationRate(Number((await schnoodle.methods.getEleemosynaryDetails().call())[1]));
        setSowRate(Number(await schnoodle.methods.getSowRate().call()));
        setSellQuota({ blockMetric: Number(sellQuota.blockMetric), amount: BigInt(sellQuota.amount) });
        setFarmingFundBalance(BigInt(await schnoodle.methods.balanceOf(await schnoodle.methods.getFarmingFund().call()).call()));
        setBalance(BigInt(await schnoodle.methods.balanceOf(selectedAddress).call()));
        setLockedBalance(BigInt(await schnoodleFarming.methods.lockedBalanceOf(selectedAddress).call()));
        setUnbondingBalance(BigInt(await schnoodleFarming.methods.unbondingBalanceOf(selectedAddress).call()));
        setAvailableAmount(BigInt(await schnoodle.methods.unlockedBalanceOf(selectedAddress).call()));

        const vestingBlocksFactor = await schnoodleFarming.methods.getVestingBlocksFactor().call() / 1000;
        const unbondingBlocksFactor = await schnoodleFarming.methods.getUnbondingBlocksFactor().call() / 1000;
        setVestingBlocksFactor(vestingBlocksFactor);
        setUnbondingBlocksFactor(unbondingBlocksFactor);
        setFactoredVestingBlocksMax(Math.floor(blocksPerDuration({ years: 1 }) * vestingBlocksFactor));
        setFactoredUnbondingBlocksMax(Math.floor(await schnoodleFarming.methods.getMaxUnbondingBlocks().call() * unbondingBlocksFactor));

        // Fetch the farming summary while also calculating the APY for each deposit
        const farmingSummary = await Promise.all([].concat(await schnoodleFarming.methods.getFarmingSummary(selectedAddress).call()).sort((a: any, b: any) => a.deposit.blockNumber > b.deposit.blockNumber ? 1 : -1).map(async (depositReward: any) => {
          const deposit = depositReward.deposit;
          const rewardBlock = Math.max(deposit.blockNumber + deposit.vestingBlocks, blockNumber);
          return {
            deposit: {
              id: Number(deposit.id),
              amount: BigInt(deposit.amount),
              blockNumber: Number(deposit.blockNumber),
              vestingBlocks: Number(deposit.vestingBlocks),
              unbondingBlocks: Number(deposit.unbondingBlocks),
              multiplier: Number(deposit.id)
            },
            created: new Date((await web3.eth.getBlock(deposit.blockNumber)).timestamp as number * 1000),
            reward: BigInt(depositReward.reward),
            vestimatedApy: await calculateApy(deposit.amount, await schnoodleFarming.methods.getReward(selectedAddress, deposit.id, rewardBlock).call(), rewardBlock - deposit.blockNumber)
          };
        }));

        setFarmingSummary(farmingSummary);
        setUnbondingSummary([].concat(await schnoodleFarming.methods.getUnbondingSummary(selectedAddress).call()).sort((a: any, b: any) => a.expiryBlock > b.expiryBlock ? 1 : -1));

        setTimeout(getInfo, 10000);
      })();
    }
  }, [schnoodle, schnoodleFarming]);

  //#region Handling

  const handleReceipt = (receipt: any): void => {
    if (receipt.status) {
      setStatus({ success: true, message: receipt.transactionHash });
    } else {
      throw new Error(receipt);
    }
  }

  //#endregion

  //#region Vesting blocks functions

  const vestingBlocks = useCallback(() => {
    return factoredVestingBlocks / vestingBlocksFactor;
  }, [factoredVestingBlocks, vestingBlocksFactor]);

  const updateVestingBlocks = (e: any): void => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setFactoredVestingBlocks(Math.min(value, factoredVestingBlocksMax));
  }

  const addVestingBlocks = (blocks: number): void => {
    setFactoredVestingBlocks(Math.min(factoredVestingBlocks + blocks, factoredVestingBlocksMax));
  }

  const maxVestingBlocks = (): void => {
    setVestingBlocksFactor(factoredVestingBlocksMax);
  }

  //#endregion

  //#region Unbonding blocks functions

  const unbondingBlocks = useCallback(() => {
    return factoredUnbondingBlocks / unbondingBlocksFactor;
  }, [factoredUnbondingBlocks, unbondingBlocksFactor]);

  const updateUnbondingBlocks = (e: any): void => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setFactoredUnbondingBlocks(Math.min(value, factoredUnbondingBlocksMax));
  }

  const addUnbondingBlocks = (blocks: number): void => {
    setFactoredUnbondingBlocks(Math.min(factoredUnbondingBlocks + blocks, factoredUnbondingBlocksMax));
  }

  const maxUnbondingBlocks = (): void => {
    setUnbondingBlocksFactor(factoredUnbondingBlocksMax);
  }

  //#endregion

  //#region Deposit functions

  const preventDust = (userAmount: number, maxAmount: bigint): bigint => {
    return userAmount === scaleDownUnits(maxAmount) ? maxAmount : scaleUpUnits(userAmount);
  }

  const addDeposit = async (): Promise<void> => {
    try {
      if (!schnoodleFarming) return;
      const depositAmountValue = preventDust(depositAmount, availableAmount);
      const receipt = await schnoodleFarming.methods.addDeposit(depositAmountValue.toString(), vestingBlocks(), unbondingBlocks()).send({ from: selectedAddress });
      await handleReceipt(receipt);
    } catch (err) {
      await handleError(err as Error, setStatus);
    }
  }

  const withdraw = async (i: number): Promise<void> => {
    try {
      if (!schnoodleFarming) return;
      const depositInfo = farmingSummary[i];
      const amountToWithdraw = preventDust(withdrawAmounts[i], depositInfo.deposit.amount);
      const receipt = await schnoodleFarming.methods.withdraw(depositInfo.deposit.id, amountToWithdraw.toString()).send({ from: selectedAddress });
      await handleReceipt(receipt);
    } catch (err) {
      await handleError(err as Error, setStatus);
    }
  }

  //#endregion

  //#region Withdraw amount functions

  const updateWithdrawAmount = (index: number, e: any): void => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    withdrawAmounts[index] = Math.min(value, scaleDownUnits(farmingSummary[index].deposit.amount));
    setWithdrawAmounts([...withdrawAmounts]);
  }

  const maxWithdraw = (index: number): void => {
    withdrawAmounts[index] = scaleDownUnits(farmingSummary[index].deposit.amount);
    setWithdrawAmounts(withdrawAmounts);
  }

  //#endregion

  //#region Deposit amount functions

  const setDepositAmountLimited = useCallback((amount: number): void => {
    setDepositAmount(Math.min(Math.floor(amount), scaleDownUnits(availableAmount)));
  }, [availableAmount]);

  const updateDepositAmount = (e: any): void => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setDepositAmountLimited(value);
  }

  //#endregion

  //#region Vestimates / Vestiplots

  const getVestimates = useCallback(async (amount: number, vestingBlocks: number, unbondingBlocks: number) => {
    if (amount === 0 || vestingBlocks === 0 || unbondingBlocks === 0 || !schnoodleFarming) {
      return [0, 0];
    }

    const vestimatedReward = scaleDownUnits(await schnoodleFarming.methods.getReward(scaleUpUnits(amount).toString(), vestingBlocks, unbondingBlocks, blockNumber + vestingBlocks).call());
    const vestimatedApy = await calculateApy(BigInt(amount), BigInt(vestimatedReward), vestingBlocks);

    return [vestimatedReward, vestimatedApy];
  }, [blockNumber, schnoodleFarming]);

  const updateVestimates = useDebounce(async () => {
    const [vestimatedReward, vestimatedApy] = await getVestimates(depositAmount, vestingBlocks(), unbondingBlocks());
    setVestimatedReward(vestimatedReward);
    setVestimatedApy(vestimatedApy);
  }, 500);

  const updateVestiplots = useDebounce(async () => {
    setVestiplotsCancellationToken();

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
    setOptimumVestingBlocks(optimumVestingBlocks);
    setOptimumUnbondingBlocks(optimumUnbondingBlocks);

    if (depositAmount > 0) {
      const steps = vestingBlocksList.length * unbondingBlocksList.length;
      let maxVestimatedApy = 0;
      let vestiplotProgress = 0;

      for (const vestingBlocksItem of vestingBlocksList) {
        for (const unbondingBlocksItem of unbondingBlocksList) {
          if (vestiplotsCancellationToken.cancelled) return;

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
          setVestiplotProgress(Math.floor(100 * ++vestiplotProgress / steps));
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

    setOptimumVestingBlocks(optimumVestingBlocks);
    setOptimumUnbondingBlocks(optimumUnbondingBlocks);
    setVestiplotReward(vestiplotReward);
    setVestiplotApy(vestiplotApy);
  }, 2000);

  const maximiseApy = (): void => {
    setFactoredVestingBlocks(optimumVestingBlocks);
    setFactoredUnbondingBlocks(optimumUnbondingBlocks);
  }

  useEffect(() => {
    updateVestimates();
    updateVestiplots();
  }, [depositAmount, factoredVestingBlocks, factoredUnbondingBlocks, updateVestimates, updateVestiplots]);

  //#endregion

  //#region Help functions

  const openHelpModal = (content: any): void => {
    setOpenHelpModal(true);
    setHelpData({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS });
  }

  const closeHelpModal = (): void => {
    setOpenHelpModal(false);
  }
  
  //#endregion

  //#region Rendering

  const renderFarmingSummaryTable = (farmingSummary: IFarm[]) => {
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
          {farmingSummary.map((farm: IFarm, i: number) => {
            const amount = scaleDownUnits(farm.deposit.amount);
            const pendingBlocks = getPendingBlocks(Math.floor(farm.deposit.vestingBlocks * vestingBlocksFactor), farm.deposit.blockNumber, blockNumber);
            const unbondingBlocks = Math.floor(farm.deposit.unbondingBlocks * unbondingBlocksFactor);
            const withdrawAmount = withdrawAmounts[i] !== undefined ? withdrawAmounts[i] : scaleDownUnits(farmingSummary[i].deposit.amount);

            return (
              <div role="row" key={farm.deposit.blockNumber}>
                <span role="cell" data-header={resources.FARMING_SUMMARY.BLOCK_NUMBER.TITLE + ':'} className="tw-border-l-0 narrower">{farm.deposit.blockNumber}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CREATED.TITLE + ':'} className="narrower" title={farm.created.toLocaleTimeString()}>{farm.created.toLocaleDateString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.DEPOSIT_AMOUNT.TITLE + ':'}>{amount.toLocaleString()}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.PENDING_BLOCKS.TITLE + ':'} className="narrower" title={blocksDurationText(pendingBlocks)}>{pendingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.UNBONDING_BLOCKS.TITLE + ':'} className="narrower" title={blocksDurationText(unbondingBlocks)}>{unbondingBlocks}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.VESTIMATED_APY.TITLE + ':'} className="narrower">{farm.vestimatedApy}%</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.MULTIPLIER.TITLE + ':'} className="narrow">{farm.deposit.multiplier / 1000}</span>
                <span role="cell" data-header={resources.FARMING_SUMMARY.CURRENT_REWARD.TITLE + ':'}>{scaleDownUnits(farm.reward).toLocaleString()}</span>
                <span role="cell" className="wider">
                  <form>
                    <fieldset disabled={pendingBlocks > 0}>
                      <div className="tw-relative">
                        <div className="tw-flex">
                          <input type="number" min="1" max={amount} value={withdrawAmount || ''} onChange={(e) => updateWithdrawAmount(i, e)} className="withdrawinput" />
                          <button type="button" onClick={() => maxWithdraw(i)} className="maxwithdraw">Max</button>
                          <button type="button" className="withdrawbtn" disabled={withdrawAmount < 1 || withdrawAmount > amount} onClick={() => withdraw(i)}><span>Withdraw</span></button>
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

  const renderUnbondingSummaryTable = (unbondingSummary: IUnbond[]) => {
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
          {unbondingSummary.map((unbond: IUnbond) => {
            const amount = scaleDownUnits(unbond.amount);
            const pendingBlocks = unbond.expiryBlock - blockNumber;
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
  
  if (!web3) {
    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
          <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo"/>
              <div className="maintitles tw-uppercase">{resources.MOON_FARMING}</div>
              <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6"/>
              <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{
                general.LOADING}<span>.</span><span>.</span><span>.</span></p>
              <div className="tw-px-4 tw-mt-4 fakebtn">&nbsp;</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayAvailableAmount = scaleDownUnits(availableAmount);

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
                  <div className="tw-stat-value greenfade">{scaleDownUnits(sellQuota.amount).toLocaleString()}</div>
                  <div className="tw-stat-desc">{token} since {new Date(sellQuota.blockMetric * 1000).toLocaleString()}</div>
                </div>
                <div className="tw-stat">
                  <div className="tw-stat-title">
                    {resources.FARMING_FUND_BALANCE.TITLE}
                    <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_FUND_BALANCE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                  </div>
                  <div className="tw-stat-value greenfade">{scaleDownUnits(farmingFundBalance).toLocaleString()}</div>
                  <div className="tw-stat-desc">{token}</div>
                </div>
              </div>

              <div className="tw-stats stats topstats">
                <div className="tw-stat">
                  <div className="tw-stat-title">
                    {resources.OPERATIVE_FEE_RATE.TITLE}
                    <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.OPERATIVE_FEE_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                  </div>
                  <div className="tw-stat-value greenfade">{operativeFeeRate / 10}</div>
                  <div className="tw-stat-desc">%</div>
                </div>
                <div className="tw-stat">
                  <div className="tw-stat-title">
                    {resources.ELEEMOSYNARY_DONATION_RATE.TITLE}
                    <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.ELEEMOSYNARY_DONATION_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                  </div>
                  <div className="tw-stat-value greenfade">{donationRate / 10 ?? 0}</div>
                  <div className="tw-stat-desc">%</div>
                </div>
                <div className="tw-stat">
                  <div className="tw-stat-title">
                    {resources.FARMING_FUND_SOW_RATE.TITLE}
                    <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.FARMING_FUND_SOW_RATE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                  </div>
                  <div className="tw-stat-value greenfade">{sowRate / 10}</div>
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
                      <div className="tw-stat-value purplefade">{scaleDownUnits(balance).toLocaleString()}</div>
                      <div className="tw-stat-desc">{token}</div>
                    </div>
                    <div className="tw-stat">
                      <div className="tw-stat-title">
                        {resources.LOCKED_BALANCE.TITLE}
                        <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.LOCKED_BALANCE)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                      </div>
                      <div className="tw-stat-value purplefade">{scaleDownUnits(lockedBalance).toLocaleString()}</div>
                      <div className="tw-stat-desc">{token}{scaleDownUnits(unbondingBalance) > 0 && (<span className="opacity-60 text-xs"><br />{scaleDownUnits(unbondingBalance).toLocaleString()} unbonding</span>)}</div>
                    </div>
                    <div className="tw-stat">
                      <div className="tw-stat-title">
                        {resources.AVAILABLE_AMOUNT.TITLE}
                        <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.AVAILABLE_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                      </div>
                      <div className="tw-stat-value purplefade">{scaleDownUnits(availableAmount)}</div>
                      <div className="tw-stat-desc">{token}</div>
                    </div>
                  </div>

                  <div className="tw-divider tw-mt-10">
                    <h3 className="sectiontitle tw-text-2xl md:tw-text-3xl tw-leading-tight">{resources.ADD_DEPOSIT}</h3>
                  </div>

                  <div className="tw-card-actions tw-text-center tw-mx-auto tw-w-full">
                    <form className="tw-justify-center fullhalfwidth tw-mx-auto tw-mt-5">
                      <fieldset disabled={availableAmount === 0n}>
                        <div className="tw-form-control">
                          <div>
                            <label className="tw-label">
                              <span className="tw-label-text">
                                {resources.DEPOSIT_AMOUNT.TITLE}
                                <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.DEPOSIT_AMOUNT)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                              </span>
                            </label>
                            <div className="tw-relative tw-flex">
                              <input type="number" min="1" max={displayAvailableAmount} placeholder={`Max: ${displayAvailableAmount}`} value={depositAmount || ''} onChange={updateDepositAmount} className="depositinput" />
                              <button type="button" className="dwmbtn hidesmmd" onClick={() => setDepositAmountLimited(displayAvailableAmount / 4)}>25%</button>
                              <button type="button" className="dwmbtn hidesmmd" onClick={() => setDepositAmountLimited(displayAvailableAmount / 2)}>50%</button>
                              <button type="button" className="dwmbtn hidesmmd" onClick={() => setDepositAmountLimited(displayAvailableAmount * 3 / 4)}>75%</button>
                              <button type="button" className="dwmbtn hidelg" onClick={() => setDepositAmountLimited(displayAvailableAmount / 4)}>&frac14;</button>
                              <button type="button" className="dwmbtn hidelg" onClick={() => setDepositAmountLimited(displayAvailableAmount / 2)}>&frac12;</button>
                              <button type="button" className="dwmbtn hidelg" onClick={() => setDepositAmountLimited(displayAvailableAmount * 3 / 4)}>&frac34;</button>
                              <button type="button" className="maxbtn" onClick={() => setDepositAmountLimited(displayAvailableAmount)}>Max</button>
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
                            <input type="number" min="1" max={factoredVestingBlocksMax} placeholder={`Max: ${factoredVestingBlocksMax}`} value={factoredVestingBlocks} onChange={updateVestingBlocks} className="depositinput w-full" />
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ weeks: 1 }))}>Week</button>
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addVestingBlocks(blocksPerDuration({ months: 1 }))}>Month</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ weeks: 1 }))} title="Week">W</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addVestingBlocks(blocksPerDuration({ months: 1 }))} title="Month">M</button>
                            <button type="button" className="maxbtn" onClick={maxVestingBlocks}>Max</button>
                          </div>
                          <p className="approxLabel">{blocksDurationText(factoredVestingBlocks)}</p>
                        </div>
                        <div className="tw-mb-3 tw-form-control nobutton">
                          <label className="tw-label">
                            <span className="tw-label-text">
                              {resources.UNBONDING_BLOCKS.TITLE}
                              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() =>openHelpModal(resources.UNBONDING_BLOCKS)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer tw-minustop" />
                            </span>
                          </label>
                          <div className="tw-mb-3 tw-flex">
                            <input type="number" min="1" max={factoredUnbondingBlocksMax} placeholder={`Max: ${factoredUnbondingBlocksMax}`} value={factoredUnbondingBlocks || ''} onChange={updateUnbondingBlocks} className="depositinput" />
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))}>Minute</button>
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ hours: 1 }))}>Hour</button>
                            <button type="button" className="dwmbtn hidesmmd" onClick={() => addUnbondingBlocks(blocksPerDuration({ days: 1 }))}>Day</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ minutes: 1 }))} title="Minute">M</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ hours: 1 }))} title="Hour">H</button>
                            <button type="button" className="dwmbtn hidelg" onClick={() => addUnbondingBlocks(blocksPerDuration({ days: 1 }))} title="Day">D</button>
                            <button type="button" className="maxbtn" onClick={maxUnbondingBlocks}>Max</button>
                          </div>
                          <p className="approxLabel">{blocksDurationText(factoredUnbondingBlocks)}</p>
                        </div>
                        <div className="tw-mb-3 tw-form-control">
                          <button type="button" className="keybtn maxbtn maximise" disabled={optimumVestingBlocks === 0 || optimumVestingBlocks === 0} onClick={maximiseApy}>Maximise APY</button>
                        </div>
                        <div className="tw-shadow-sm bottomstats tw-stats stats">
                          <div className="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                            <div className="tw-stat-title">
                              {resources.VESTIMATED_REWARD.TITLE}
                              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.VESTIMATED_REWARD)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                            </div>
                            <div className="tw-stat-value tw-text-accent">{vestimatedReward.toLocaleString()}</div>
                            <div className="tw-stat-desc">{token}</div>
                          </div>
                          <div className="tw-stat tw-border-t-1 md:tw-border-t-0 md:tw-border-base-200">
                            <div className="tw-stat-title">
                              {resources.VESTIMATED_APY.TITLE}
                              <img src="../../assets/img/svg/circle-help-purple.svg" alt="Help button" onClick={() => openHelpModal(resources.VESTIMATED_APY)} className="tw-h-4 tw-w-4 tw-inline-block tw-ml-2 tw-cursor-pointer minustop" />
                            </div>
                            <div className="tw-stat-value tw-text-accent">{vestimatedApy}</div>
                            <div className="tw-stat-desc">%</div>
                          </div>
                        </div>
                        <div className="tw-mb-3 tw-form-control">
                          <button type="button" className="keybtn maxbtn" disabled={depositAmount < 1 || vestingBlocks() < 1 || unbondingBlocks() < 1 || depositAmount > displayAvailableAmount} onClick={addDeposit}>Deposit</button>
                        </div>
                      </fieldset>
                    </form>
                  </div>
                  <div className="tw-grid tw-mt-4">
                    {vestiplotProgress > 0 && vestiplotProgress < 100 &&
                      <div className="tw-overlay tw-z-20">
                        <div className="overlayloader tw-flex tw-flex-col tw-items-center tw-justify-center ">
                          <div>
                            <Puff color="#00BFFF" />
                          </div>
                          <div>
                            <p className="approxLabel tw-mt-4">{vestiplotProgress}%</p>
                          </div>
                        </div>
                      </div>
                    }
                    
                    <div className="plotcontainer tw-z-10">
                      <div className="tw-flex tw-flex-col xl:tw-flex-row">
                        {vestiplotReward && vestiplotReward.length > 0 &&
                          <Plot
                            data={vestiplotReward as any}
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

                        {vestiplotApy && vestiplotApy.length > 0 &&
                          <Plot
                            data={vestiplotApy as any}
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

              {farmingSummary.length > 0 &&
                <div className="summarytable">
                  <h3 className="tw-mb-5 headingfont sectiontitle tw-mt-10">{resources.FARMING_SUMMARY.TITLE}</h3>
                  <div className="tw-overflow-x-auto tw-text-secondary tw-my-5">
                    {renderFarmingSummaryTable(farmingSummary)}
                  </div>
                </div>
              }
              {unbondingSummary.length > 0 && unbondingSummary.some((u: any) => parseInt(u.expiryBlock) - blockNumber > 0) &&
                <div className="summarytable">
                  <h3 className="tw-mb-5 tw-headingfont tw-sectiontitle tw-mt-10">{resources.UNBONDING_SUMMARY.TITLE}</h3>
                  <div className="tw-overflow-x-auto tw-text-secondary tw-my-5">{renderUnbondingSummaryTable(unbondingSummary)}</div>
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

  //#endregion
}

Farming.displayName = Farming.name;
export default Farming;
