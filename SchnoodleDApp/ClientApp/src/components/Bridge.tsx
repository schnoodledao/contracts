// ReSharper disable InconsistentNaming
import React, { useCallback, useEffect, useState } from 'react';
import { general, bridge as resources } from '../resources';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV10.json';
import { initializeHelpers, handleError, getWeb3, scaleUpUnits, scaleDownUnits, scaleDownPrecise } from '../helpers';
import { IStatus } from '../types';

// Third-party libraries
import Select, { components } from 'react-select';
import { Puff } from 'react-loader-spinner';
import { Contract } from 'web3-eth-contract';
// ReSharper restore InconsistentNaming

enum Network {
  Ethereum,
  Bsc
}

// global fetch: false

interface INetwork {
  name: string | undefined,
  id: number,
  display: string,
  symbol: string,
  rpcUrls: (string | undefined)[],
  explorerUrls: (string | undefined)[],
}

const networks: {[key: string]: INetwork} =
{
  [Network.Ethereum]: {
    name: process.env.REACT_APP_ETH_NET_NAME,
    id: Number(process.env.REACT_APP_ETH_NET_ID),
    display: 'Ethereum',
    symbol: 'ETH',
    rpcUrls: [process.env.REACT_APP_ETH_RPC_URL],
    explorerUrls: [process.env.REACT_APP_ETH_EXPLORER_URL]
  },
  [Network.Bsc]: {
    name: process.env.REACT_APP_BSC_NET_NAME,
    id: Number(process.env.REACT_APP_BSC_NET_ID),
    display: 'BSC',
    symbol: 'BNB',
    rpcUrls: [process.env.REACT_APP_BSC_RPC_URL],
    explorerUrls: [process.env.REACT_APP_BSC_EXPLORER_URL]
  }
};

function getNetworkById(id: number): INetwork {
  return Object.values(networks).find(value => value.id === id) as INetwork;
}

const Bridge: React.FC = () => {
  const [networkId, setNetworkId] = useState<number>();
  const [schnoodle, setSchnoodle] = useState<Contract>();
  const [fee, setFee] = useState<bigint>(0n);
  const [availableAmount, setAvailableAmount] = useState<bigint>(0n);

  const [amount, setAmount] = useState(0);
  const [tokensPending, setTokensPending] = useState<bigint>(0n);
  const [sourceNetworkId, setSourceNetworkId] = useState(Number(localStorage.getItem('sourceNetworkId')));
  const [targetNetworkId, setTargetNetworkId] = useState(Number(localStorage.getItem('targetNetworkId')));

  const [busySwap, setBusySwap] = useState(false);
  const [busyReceive, setBusyReceive] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const [serverStatus, setServerStatus] = useState(false);
  const [status, setStatus] = useState<IStatus>({ success: true, message: null });

  const web3 = getWeb3();
  const selectedAddress = web3.currentProvider.selectedAddress;

  const changeSourceNetworkId = useCallback(async (e: any) => {
    if (e.value === targetNetworkId || targetNetworkId === 0) {
      setTargetNetworkId(Object.values(networks).find(value => value.id !== e.value)?.id ?? 0);
    }

    setSourceNetworkId(e.value);
  }, [sourceNetworkId]);

  const changeTargetNetworkId = useCallback(async (e: any) => {
    if (e.value === sourceNetworkId || sourceNetworkId === 0) {
      setSourceNetworkId(Object.values(networks).find(value => value.id !== e.value)?.id ?? 0);
    }

    setTargetNetworkId(e.value);
  }, [targetNetworkId]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const networkId = await web3.eth.net.getId();
        const schnoodleNetwork = SchnoodleV1.networks[networkId];
        const schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleNetwork.address);

        if (sourceNetworkId === 0) {
          changeSourceNetworkId({ value: networkId });
        }

        await initializeHelpers(await schnoodle.methods.decimals().call());

        setNetworkId(networkId);
        setSchnoodle(schnoodle);
      } catch (err) {
        handleError(err as Error, setStatus);
      }
    }

    initialize();
  }, []);

  window.ethereum.on('networkChanged', () => window.location.reload());

  const getFee = async (networkId: number): Promise<bigint> => {
    // Get the fee that must be paid before receiving tokens on the blockchain
    const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetFee`,
      {
        method: 'POST',
        body: JSON.stringify({ networkId })
      })).json();

    if (json.status === 'ok') {
      return BigInt(json.body.fee);
    } else {
      throw new Error(json.body.message);
    }
  };

  const getInfo = useCallback(async () => {
    let serverStatus = false;

    try {
      serverStatus = (await fetch(`${process.env.REACT_APP_SERVER_URL}/Alive`)).ok;

      if (serverStatus) {
        if (selectedAddress) {
          const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetTokensPending`, {
            method: 'POST',
            body: JSON.stringify({ address: selectedAddress, sourceNetworkId, targetNetworkId })
          })).json();

          if (json.status === 'ok') {
            setTokensPending(BigInt(json.body.tokensPending));
          } else {
            setServerError(json.body.message);
          }
        }

        setFee(await getFee(targetNetworkId));
      }
    } catch (err) {
      handleError(err as Error, setStatus, false);
    }

    setServerStatus(serverStatus);

    if (selectedAddress && schnoodle) {
      setAvailableAmount(BigInt(await schnoodle.methods.unlockedBalanceOf(selectedAddress).call()));
    }
  }, [selectedAddress, sourceNetworkId, targetNetworkId, schnoodle]);

  useEffect(() => {
    getInfo();
    const intervalId = setInterval(async () => {
      await getInfo();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [getInfo]);

  //#region Handling

  const handleReceipt = (receipt: any) => {
    if (receipt.status) {
      setStatus({ success: true, message: receipt.transactionHash });
    } else {
      throw new Error(receipt);
    }
  };
  
  //#endregion

  const switchNetwork = async (network: INetwork, callback?: any) => {
    try {
      // Attempt to switch the user's wallet to the target network so they can receive their tokens
      if (Number(window.ethereum.networkVersion) !== network.id) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(network.id) }]
        });
      } else {
        await callback();
      }
    } catch (err) {
      // This error code indicates that the chain has not been added to the wallet
      if ((err as any).code === 4902 || (err as any).data?.originalError?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainName: network.name,
              chainId: web3.utils.toHex(network.id),
              nativeCurrency: {
                name: network.symbol,
                symbol: network.symbol,
                decimals: 18
              },
              rpcUrls: network.rpcUrls,
              blockExplorerUrls: network.explorerUrls
            }
          ]
        });
      } else {
        throw err;
      }
    }
  };

  const sendTokens = async () => {
    try {
      if (!schnoodle) return;
      setBusySwap(true);

      // Ensure the user's wallet is set to the source network so they can send their tokens
      await switchNetwork(getNetworkById(sourceNetworkId), async () => {
        const targetNetwork = getNetworkById(targetNetworkId);

        handleReceipt(await schnoodle.methods.sendTokens(targetNetwork.id, scaleUpUnits(amount).toString()).send({ from: selectedAddress }));

        // Attempt to switch the user's wallet to the target network so they can receive their tokens
        await switchNetwork(targetNetwork);
      });
    } catch (err) {
      handleError(err as Error, setStatus);
    }

    setBusySwap(false);
  }

  const receiveTokens = async () => {
    try {
      if (!schnoodle) return;
      setBusyReceive(true);

      // Ensure the user's wallet is set to the target network so they can receive their tokens
      await switchNetwork(getNetworkById(targetNetworkId), async () => {
        // Pay the fee (suggested by the server) to the Schnoodle contract
        const fee = await getFee(targetNetworkId) - await schnoodle.methods.feesPaid(selectedAddress, sourceNetworkId).call();
        if (fee > 0) handleReceipt(await schnoodle.methods.payFee(sourceNetworkId).send({ from: selectedAddress, value: fee }));

        // Request the server to call receiveTokens on the Schnoodle contract
        const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/ReceiveTokens`, {
          method: 'POST',
          body: JSON.stringify({ address: selectedAddress, sourceNetworkId, targetNetworkId })
        })).json();

        if (json.status !== 'ok') {
          setServerError(json.body.message);
        } else {
          await getInfo();
        }
      });
    } catch (err) {
      handleError(err as Error, setStatus);
    }

    setBusyReceive(false);
  };

  const swapNetworks = async () => {
    setSourceNetworkId(targetNetworkId);
    setTargetNetworkId(sourceNetworkId);
  };

  useEffect(() => {
    if (sourceNetworkId > 0) {
      localStorage.setItem('sourceNetworkId', sourceNetworkId.toString());
    }
  }, [sourceNetworkId]);

  useEffect(() => {
    if (targetNetworkId > 0) {
      localStorage.setItem('targetNetworkId', targetNetworkId.toString());
    }
  }, [targetNetworkId]);

  const setAmountLimited = useCallback(async (value: number) => {
    setAmount(Math.min(Math.floor(value), sourceNetworkId === networkId ? scaleDownUnits(availableAmount) : Infinity));
  }, [sourceNetworkId, networkId, availableAmount]);

  const updateAmount = async (e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setAmountLimited(value);
  };

  useEffect(() => {
    setAmountLimited(Number(localStorage.getItem(`Network${sourceNetworkId}Amount`)));
  }, [setAmountLimited, sourceNetworkId]);

  useEffect(() => {
    localStorage.setItem(`Network${sourceNetworkId}Amount`, amount.toString());
  }, [amount, sourceNetworkId]);

  const styles = {
    valueContainer: () => ({ width: 120, border: 'none', display: 'grid' }),
    singleValue: (base: any) => ({ ...base, color: 'white', }),
    control: (base: any) => ({ ...base, background: '#070c39', borderRadius: '0.5em', borderWidth: '0px', boxShadow: '0px 12px 7px rgba(0, 0, 0, 0.34)' }),
    dropdownIndicator: (base: any) => ({ ...base, color: 'white' }),
    menuList: (base: any) => ({ ...base, background: '#070c39', color: 'white' }),
    option: (provided: any, state: any) => ({ ...provided, color: state.isSelected || state.isFocused ? '#dc20bc' : 'white', background: '#070c39' })
  }

  const { Option, SingleValue }: any = components;  

  const option: React.FC = (props: any) => (
    <div className="tw-flex">
      <img className="tw-w-1/6 tw-mx-1 plustop" src={`/assets/img/svg/${props.data.label.toLowerCase()}.svg`} alt={props.data.label} />
      <span className="plustop">{props.data.label}</span>
    </div>
  );

  const singleValue = (props: any) => (
    <SingleValue {...props}>
      {option(props)}
    </SingleValue>
  );

  const singleOption = (props: any) => (
    <Option {...props}>
      {option(props)}
    </Option>
  );

  const busyMessage = busySwap
    ? resources.BUSY_MESSAGE_SWAP
    : busyReceive
      ? resources.BUSY_MESSAGE_RECEIVE
      : null;

  let bridge: any;

  if (!web3 || !serverStatus) {
    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
          <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
              <div className="maintitles tw-uppercase">{resources.BRIDGE}</div>
              <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
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
  const sourceNetworks = Object.keys(networks).map((key) => { return { value: networks[key].id, label: networks[key].display } });
  const targetNetworks = sourceNetworks;

  if (busyMessage) {
    bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-color tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
      <Puff color="#00BFFF" />
      <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{busyMessage}</div>
    </div>;
  } else if (serverError != null) {
    bridge = <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
      <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{`Server error: ${serverError}`}</div>
    </div>;
  } else {
    const token = 'SNOOD';
    bridge =
    <div className="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
      <div className="tw-col-span-7 tw-p-9 lg:tw-px-6 tw-rounded-13 lg:bg-violet-900 tw-bg-transparent">
        <div className="tw-flex tw-items-center tw-flex-col lg:tw-flex-row">
          <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mb-5 lg:tw-mb-0 tw-p-12 tw-rounded-xl tw-bg-neutral lg:tw-bg-transparent">
            <div className="tw-flex tw-flex-col">
              <div className="tw-font-bold tw-uppercase lg:tw-mb-2 tw-text-white">From</div>
              <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                <div>
                  <div className="purplefade tw-uppercase tw-text-xl tw-font-bold">{token}</div>
                    <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(network => network.value === sourceNetworkId)} onChange={changeSourceNetworkId} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }} />
                </div>
              </div>
            </div>
          </div>
          <button type="button" onClick={swapNetworks} className="tw-z-0 tw-p-2 tw-btn-accent lg:tw-w-1/6 tw-h-10 tw-content-center tw-rounded-lg outline-none focus:outline-none tw--my-4 lg:tw-mt-7 tw-relative lg:tw-static tw-transform tw-rotate-90 lg:tw-transform-none">
            <img className="tw-block tw-w-5 tw-h-5 tw-mx-auto" src="/assets/img/svg/arrows.svg" alt="" />
          </button>
          <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mt-5 tw-mb-5 lg:tw-mt-5 -mt-3 tw-bg-neutral lg:tw-bg-transparent tw-p-12 tw-rounded-xl">
            <div className="tw-flex tw-flex-col">
              <div className="tw-font-bold tw-uppercase lg:tw-mb-2 tw-text-white">To</div>
              <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                <div>
                  <div className="purplefade tw-uppercase tw-text-xl tw-font-bold">{token}</div>
                  <Select styles={styles} options={targetNetworks} value={targetNetworks.find(network => network.value === targetNetworkId)} onChange={changeTargetNetworkId} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {tokensPending > 0n
          ? <div className="tw-col-span-7 lg:bg-color lg:tw-px-14 tw-px-4 tw-rounded-xl tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl">
              <div className="tw-text-center tw-mb-14 tw-leading-normal">
                <span className="tw-text-accent tw-font-medium">{scaleDownUnits(tokensPending)}</span> <span className="tw-text-white tw-font-bold">{`${token} ready to be received`}</span>
              </div>
              <button type="button" onClick={receiveTokens} className="tw-w-1/2 keybtn maxbtn">{targetNetworkId === networkId ? 'RECEIVE' : 'SWITCH NETWORK'}</button>
            </div>
          : <div className="md:tw-m-auto md:tw-w-1/2">
              <form>
                <fieldset disabled={sourceNetworkId !== networkId || selectedAddress == null}>
                  <div className="tw-relative tw-mb-10 tw-flex">
                    <input type="number" min="1" max={displayAvailableAmount} placeholder={`Max: ${sourceNetworkId === networkId ? displayAvailableAmount : 'Switch Network'}`} value={amount || ''} onChange={updateAmount} className="depositinput" />
                    <button type="button" className="dwmbtn hidesmmd" onClick={() => setAmountLimited(displayAvailableAmount / 4)}>25%</button>
                    <button type="button" className="dwmbtn hidesmmd" onClick={() => setAmountLimited(displayAvailableAmount / 2)}>50%</button>
                    <button type="button" className="dwmbtn hidesmmd" onClick={() => setAmountLimited(displayAvailableAmount * 3 / 4)}>75%</button>
                    <button type="button" className="dwmbtn hidelg" onClick={() => setAmountLimited(displayAvailableAmount / 4)}>&frac14;</button>
                    <button type="button" className="dwmbtn hidelg" onClick={() => setAmountLimited(displayAvailableAmount / 2)}>&frac12;</button>
                    <button type="button" className="dwmbtn hidelg" onClick={() => setAmountLimited(displayAvailableAmount * 3 / 4)}>&frac34;</button>
                    <button type="button" className="maxbtn" onClick={() => setAmountLimited(displayAvailableAmount)}>Max</button>
                  </div>
                </fieldset>
              </form>
              <button type="button" onClick={sendTokens} disabled={amount === 0 && sourceNetworkId === networkId} className="keybtn maxbtn tw-w-full">{sourceNetworkId === networkId ? 'SEND' : 'SWITCH NETWORK'}</button>
              <div className="tw-col-span-5 tw-rounded-13 lg:tw-pt-10 lg:tw-bg-violet-900 tw-bg-transparent tw-relative">
                {fee > 0n &&
                  <div>
                    <div className="tw-flex tw-justify-center purplefade tw-mb-7">
                      Receive Fee:
                      <div className="tw-ml-1.5 tw-text-white">{`${scaleDownPrecise(fee, 6)} ${getNetworkById(targetNetworkId).symbol}`}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
        }
        <div className="tw-text-center tw-mt-2.5">
          <p style={{ color: status?.success ? 'green' : 'red' }}>{status?.message}</p>
        </div>
      </div>
    </div>;
  }

  return (
    <div className="tw-font-Roboto tw-flex tw-flex-col tw-min-h-screen tw-bg-violet-900">
      <div className="tw-flex-grow">
        <div className="tw-mx-auto tw-w-full lg:tw-max-w-5xl tw-px-4">
          <div className="lg:tw-grid tw-block">
            <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.BRIDGE}</h1>
            {bridge}
          </div>
        </div>
      </div>

      <footer className="tw-hidden lg:tw-block tw-bg-violet-900 tw-h-9" />
    </div>
  );
}

Bridge.displayName = Bridge.name;
export default Bridge;
