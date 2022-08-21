// ReSharper disable InconsistentNaming
import { useCallback } from 'react';
import Web3 from 'web3';
import { Duration } from 'luxon';
import humanizeDuration from 'humanize-duration';
import { DebouncedFunc , debounce } from 'lodash-es';
import { IStatus } from './types';
// ReSharper restore InconsistentNaming

let decimals = 0;
let averageBlockTime = 0;

export async function initializeHelpers(decimalsValue: number): Promise<void> {
  decimals = decimalsValue;
  await setAverageBlockTime();
}

//#region Web3 Helpers

export function getWeb3(): any {
  return (window as any).ethereum
    ? new Web3((window as any).ethereum) // Modern DApp browsers
    : (window as any).web3
      ? (window as any).web3 // Legacy DApp browsers
      : new Web3(new Web3.providers.HttpProvider('http://localhost:8545')); // Fallback to localhost; use dev console port by default
}

export function scaleDownPrecise(amount: bigint, precision: number): string {
  return Number(amount / 10n ** BigInt(decimals)).toPrecision(precision);
}

export function scaleDownUnits(amount: bigint): number {
  return Number(amount / (10n ** BigInt(decimals)));
}

export function scaleUpUnits(amount: number): bigint {
  return BigInt(amount) * 10n ** BigInt(decimals);
}

export async function setAverageBlockTime(): Promise<void> {
  const web3 = getWeb3();
  const blockNumber = await web3.eth.getBlockNumber();

  if (blockNumber > 0) {
    const blocksDenominator = Math.min(500, blockNumber);
    const currentBlockTimestamp = (await web3.eth.getBlock(blockNumber)).timestamp as number;
    const compareBlockTimestamp = (await web3.eth.getBlock(blockNumber - blocksDenominator)).timestamp as number;

    if (currentBlockTimestamp === undefined || compareBlockTimestamp === undefined) {
      alert('Block timestamp unable to be obtained at this time. This may only be a temporary issue.');
    } else {
      averageBlockTime = (currentBlockTimestamp - compareBlockTimestamp) / blocksDenominator;
    }
  }
}

export function calculateApy(amount: bigint, reward: bigint, blocks: number): number {
  return Number(reward / amount) / blocks / blocksPerDuration({ years: 1 }) * 100;
}

export function blocksPerDuration(duration: { [key: string]: number }): number {
  return averageBlockTime === 0 ? 0 : Math.floor(Duration.fromObject(duration).as('seconds') / averageBlockTime);
}

export function blocksDurationText(blocks: number): string {
  return (blocks !== 0 ? 'Approximately ' : '') + humanizeDuration(Duration.fromObject({ seconds: blocks * averageBlockTime }).as('milliseconds'), { largest: 2, round: true });
}

export function getPendingBlocks(vestingBlocks: number, startBlockNumber: number, currentBlockNumber: number): number {
  return Math.max(0, startBlockNumber + vestingBlocks - currentBlockNumber);
}

//#endregion

//#region General Helpers

export function handleError(err: Error, setStatus: React.Dispatch<React.SetStateAction<IStatus>>, display = true): void {
  console.error(err);

  if (display) {
    let message = err.message;

    if (err.message.includes('[ethjs-query] while formatting outputs from RPC')) {
      const match = err.message.match('(?<=\')(?:\\\\.|[^\'\\\\])*(?=\')') as string | null;
      if (match) {
        message = JSON.parse(match).value.data.message;
      }
    }

    setStatus({ success: false, message } as IStatus);
    alert(message);
  }
}

export function sleep(milliseconds: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// eslint-disable-next-line
export const useDebounce = (func: any, duration = 200): DebouncedFunc<any> => {
  return useCallback(debounce(func, duration), [func, duration]);
};

//#endregion
