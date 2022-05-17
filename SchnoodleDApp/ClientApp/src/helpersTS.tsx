// ReSharper disable InconsistentNaming
import getWeb3 from './getWeb3';
const { Duration } = require('luxon');
const humanizeDuration = require('humanize-duration');
const bigInt = require('big-integer');
// ReSharper restore InconsistentNaming

let decimals = 0;
let averageBlockTime = 0;

export async function initializeHelpers(decimalsValue: number) {
  decimals = decimalsValue;
  await setAverageBlockTime();
}

//#region Web3 Helpers

export function scaleDownPrecise(amount: number, precision: number) {
  return (amount / 10 ** decimals).toPrecision(precision);
}

export function scaleDownUnits(amount: number) {
  return bigInt(amount).divide(10 ** decimals).toJSNumber();
}

export function scaleUpUnits(amount: number) {
  return bigInt(amount).multiply(10 ** decimals);
}

export async function setAverageBlockTime() {
  const web3 = await getWeb3();
  const blockNumber = await web3.eth.getBlockNumber();

  if (blockNumber > 0) {
    const blocksDenominator = Math.min(500, blockNumber);
    const currentBlockTimestamp = (await web3.eth.getBlock(blockNumber)).timestamp;
    const compareBlockTimestamp = (await web3.eth.getBlock(blockNumber - blocksDenominator)).timestamp;

    if (currentBlockTimestamp === undefined || compareBlockTimestamp === undefined) {
      alert('Block timestamp unable to be obtained at this time. This may only be a temporary issue.');
    } else {
      averageBlockTime = (currentBlockTimestamp - compareBlockTimestamp) / blocksDenominator;
    }
  }
}

export function calculateApy(amount: number, reward: any, blocks: number) {
  console.log(amount);
  console.log(reward);
  console.log(blocks);
  console.log(blocksPerDuration({years: 1}));
  return reward === '0' ? 0 : Number((reward / amount / (blocks / blocksPerDuration({ years: 1 })) * 100).toPrecision(2));
}

export function blocksPerDuration(duration: {[key: string]: number}) {
  return averageBlockTime === 0 ? 0 : Math.floor(Duration.fromObject(duration).as('seconds') / averageBlockTime);
}

export function blocksDurationText(blocks: number) {
  return (blocks !== 0 ? 'Approximately ' : '') + humanizeDuration(Duration.fromObject({ seconds: blocks * averageBlockTime }), { largest: 2, round: true });
}

export function getPendingBlocks(vestingBlocks: any, startBlockNumber: any, currentBlockNumber: number) {
  return Math.max(0, parseInt(startBlockNumber) + parseInt(vestingBlocks) - currentBlockNumber);
}

//#endregion

//#region General Helpers

export function handleError(err: any, setStatus: any, display = true) {
  console.error(err);

  if (display) {
    let message = err.message;

    if (err.message.includes('[ethjs-query] while formatting outputs from RPC')) {
      message = JSON.parse(err.message.match('(?<=\')(?:\\\\.|[^\'\\\\])*(?=\')')).value.data.message;
    }

    setStatus({ success: false, message });
    alert(message);
  }
}

export function createEnum(values: any) {
  const enumObject: any = {};
  for (const val of values) {
    enumObject[val] = val;
  }
  return Object.freeze(enumObject);
}

export function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//#endregion
