import getWeb3 from "./getWeb3";
const { Duration } = require("luxon");
const humanizeDuration = require("humanize-duration");
const bigInt = require("big-integer");

let decimals = 0;
let averageBlockTime = 0;

export async function initializeHelpers(decimalsValue) {
  decimals = decimalsValue;
  await setAverageBlockTime();
}

//#region Web3 Helpers

export function scaleDownUnits(amount) {
  return bigInt(amount).divide(10 ** decimals).toJSNumber();
}

export function scaleUpUnits(amount) {
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

export function calculateApy(amount, reward, blocks) {
  return reward === '0' ? 0 : Number((reward / amount / (blocks / blocksPerDuration({ years: 1 })) * 100).toPrecision(2));
}

export function blocksPerDuration(duration) {
  return averageBlockTime === 0 ? 0 : Math.floor(Duration.fromObject(duration).as('seconds') / averageBlockTime);
}

export function blocksDurationText(blocks) {
  return (blocks !== 0 ? 'Approximately ' : '') + humanizeDuration(Duration.fromObject({ seconds: blocks * averageBlockTime }), { largest: 2, round: true });
}

export function getPendingBlocks(vestingBlocks, startBlockNumber, currentBlockNumber) {
  return Math.max(0, parseInt(startBlockNumber) + parseInt(vestingBlocks) - currentBlockNumber);
}

export async function waitForTransaction(hash, delay = 1000) {
  const web3 = await getWeb3();
  let transactionReceipt = null;
  while (transactionReceipt == null) { // Waiting until the transaction is mined
    transactionReceipt = await web3.eth.getTransactionReceipt(hash);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

//#endregion

//#region General Helpers

export function createEnum(values) {
  const enumObject = {};
  for (const val of values) {
    enumObject[val] = val;
  }
  return Object.freeze(enumObject);
}

export function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//#endregion
