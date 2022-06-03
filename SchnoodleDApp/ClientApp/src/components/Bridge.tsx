// ReSharper disable InconsistentNaming
import React, { useState, useEffect } from 'react';
import { bridge as resources } from '../resources';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
// @ts-ignore
import { initializeHelpers, handleError, getWeb3, scaleUpUnits, scaleDownUnits, scaleDownPrecise, createEnum } from '../helpers.tsx';
import { IStatus } from '../types';

// Third-party libraries
import Web3 from 'web3';
import Select, { components } from 'react-select';
const bigInt = require('big-integer');

const Network : {[key: string]: string} = createEnum(['ethereum', 'bsc']);
// ReSharper restore InconsistentNaming

// global fetch: false
const networks: {[key: string]: INetwork} =
{
  ethereum: {
    name: 'Ethereum',
    id: Number(process.env.REACT_APP_ETH_NET_ID),
    url: process.env.REACT_APP_ETH_URL,
    standard: 'ERC20',
    symbol: 'ETH',
    rpcUrls: ['https://mainnet.infura.io/v3/']
  },
  bsc: {
    name: 'BNB Smart Chain',
    id: Number(process.env.REACT_APP_BSC_NET_ID),
    url: process.env.REACT_APP_BSC_URL,
    standard: 'BEP20',
    symbol: 'BNB',
    rpcUrls: ['https://bsc-dataseed.binance.org/']
  }
};

interface INetwork {
  name: string,
  id: number,
  url: any,
  standard: string,
  symbol: string,
  rpcUrls: string[]
}

interface IContractData {
  web3Eth: Web3,
  web3Bsc: Web3,
  schnoodleEthNetwork: any,
  schnoodleEth: any,
  schnoodleBscNetwork: any,
  schnoodleBsc: any
}

interface INetworkData {
  web3: Web3,
  networkId: string,
  schnoodle: any,
  sourceNetwork: string
  targetNetwork: string
  selectedAddress: string
  amount?: number | null
}

interface IAmountData {
  amount: number,
  availableAmount: number
}

export default function Bridge() {
  const [amounts, setAmounts] = useState<IAmountData>({
    availableAmount: 0,
    amount: 0
  });
  const [busyMessage, setBusyMessage] = useState<string | null>();
  const [contracts, setContracts] = useState<IContractData | null>();
  const [networksData, setNetworksData] = useState<INetworkData>();
  const [fee, setFee] = useState(0);
  const [getInfoIntervalId, setGetInfoIntervalId] = useState<NodeJS.Timer | undefined>();
  const [serverError, setServerError] = useState(false);
  const [serverStatus, setServerStatus] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [status, setStatus] = useState<IStatus>();
  const [tokensPending, setTokensPending] = useState<number>();

  useEffect(() => {
    if (networksData) {
      getInfo();
      const getInfoIntervalId = setInterval(async () => await getInfo(), 10000);
      setGetInfoIntervalId(getInfoIntervalId);
      if (!networksData.targetNetwork) {
        changeSourceNetwork({ value: localStorage.getItem('sourceNetwork') ?? networksData.sourceNetwork });
        changeTargetNetwork({ value: localStorage.getItem('targetNetwork') ?? networksData.sourceNetwork });
      }
    }
  }, [networksData])

  useEffect(() => {
    if (contracts) {
      updateWeb3();
    }
  }, [contracts])

  useEffect(() => {
    try {
      // Web3
      const web3Eth = new Web3(networks[Network.ethereum].url);
      const web3Bsc = new Web3(new Web3.providers.HttpProvider(networks[Network.bsc].url));

      // Smart contracts
      const schnoodleEthNetwork = (SchnoodleV1.networks as any)[networks[Network.ethereum].id];
      const schnoodleEth = new web3Eth.eth.Contract(Schnoodle.abi as any, schnoodleEthNetwork && schnoodleEthNetwork.address);
      const schnoodleBscNetwork = (SchnoodleV1.networks as any)[networks[Network.bsc].id];
      const schnoodleBsc = new web3Bsc.eth.Contract(Schnoodle.abi as any, schnoodleBscNetwork && schnoodleBscNetwork.address);

      (window as any).ethereum.on('networkChanged', async () => await updateWeb3());
      setContracts({
        web3Eth,
        web3Bsc,
        schnoodleEthNetwork,
        schnoodleEth,
        schnoodleBscNetwork,
        schnoodleBsc
      })
    } catch (err) {
      handleError(err, setStatus);
    }
    return () => {
      clearInterval(getInfoIntervalId as NodeJS.Timer);
    }
  },[])

  const updateWeb3 = async (callback?: any) => {
    if (!contracts) {
      return
    }
    const web3 = await getWeb3();
    const { schnoodleEthNetwork, schnoodleBscNetwork } = contracts;

    let schnoodle, sourceNetwork;
    const networkId = await web3.eth.net.getId();
    const selectedAddress = web3.currentProvider.selectedAddress;
    switch (networkId.toString()) {
      case process.env.REACT_APP_ETH_NET_ID:
        schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleEthNetwork && schnoodleEthNetwork.address);
        sourceNetwork = Network.ethereum;
        break;
      case process.env.REACT_APP_BSC_NET_ID:
        schnoodle = new web3.eth.Contract(Schnoodle.abi, schnoodleBscNetwork && schnoodleBscNetwork.address);
        sourceNetwork = Network.bsc;
        break;
      default:
        throw new Error(`Network ID ${networkId} unsupported.`);
    }

    await initializeHelpers(await schnoodle.methods.decimals().call());
    setNetworksData({
      ...networksData,
      web3: web3,
      networkId: networkId,
      schnoodle: schnoodle,
      selectedAddress: selectedAddress,
      sourceNetwork: sourceNetwork
    })
    if (callback) {
      callback();
    }
  }

  const getInfo = async () => {
    let serverStatus = false;
    try {
      serverStatus = (await fetch(`${process.env.REACT_APP_SERVER_URL}/Alive`)).ok;

      if (serverStatus) {
        const { selectedAddress, sourceNetwork, targetNetwork } = networksData;

        if (selectedAddress && sourceNetwork && targetNetwork) {
          const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetTokensPending`, {
            method: 'POST',
            body: JSON.stringify({ address: selectedAddress, sourceNetwork, targetNetwork })
          })).json();

          if (json.status === 'ok') {
            setTokensPending(json.body.tokensPending);
          } else {
            setServerError(json.body.err.message);
          }
        }

        setFee(await getFee(targetNetwork));
      }
    } catch (err) {
      handleError(err, setStatus, false);
    }
    setServerStatus(serverStatus);
  }

  //#region Handling

  const handleReceipt = (receipt: any) => {
    if (receipt.status) {
      setStatus({success: true, message: receipt.transactionHash})
    } else {
      throw new Error(receipt);
    }
  }
  
  //#endregion

  const sendTokens = async() => {
    const switchNetwork = async (network:any, callback?: any) => {
      try {
        // Attempt to switch the user's wallet to the target network so they can receive their tokens
        if (Number((window as any).ethereum.networkVersion) !== network.id) {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: networksData?.web3.utils.toHex(network.id) }]
          });

          await updateWeb3(callback);
        } else {
          await callback();
        }
      } catch (err: any) {
        // This error code indicates that the chain has not been added to the wallet
        if (err.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainName: network.name,
                chainId: networksData?.web3.utils.toHex(network.id),
                nativeCurrency: {
                  name: network.symbol,
                  symbol: network.symbol,
                  decimals: 18
                },
                rpcUrls: network.rpcUrls
              }
            ]
          });
        } else {
          throw err;
        }
      }
    }

    try {
      setBusyMessage(resources.BUSY_MESSAGE_SWAP);
      
      // Ensure the user's wallet is set to the source network so they can send their tokens
      await switchNetwork(networks[networksData.sourceNetwork], async () => {
        try {
          const { amount, schnoodle, selectedAddress, targetNetwork } = networksData;
          const targetNetworkInfo = networks[targetNetwork as string];

          handleReceipt(await (schnoodle as any).methods.sendTokens(targetNetworkInfo.id, scaleUpUnits(amount).toString()).send({ from: selectedAddress }));

          // Attempt to switch the user's wallet to the target network so they can receive their tokens
          await switchNetwork(targetNetworkInfo);
        } catch (err) {
          handleError(err, setStatus);
          setBusyMessage(null);
        }

        setBusyMessage(null);
      });
    } catch (err) {
      handleError(err, setStatus);
      setBusyMessage(null);
    }
  }

  const receiveTokens = async () => {
    try {
      const { schnoodle, selectedAddress, sourceNetwork, targetNetwork } = networksData;
      setBusyMessage(resources.BUSY_MESSAGE_RECEIVE);

      // Pay the fee (suggested by the server) to the Schnoodle contract
      const sourceNetworkId = networks[sourceNetwork].id;
      const fee = await getFee(targetNetwork) - await (schnoodle as any).methods.feesPaid(selectedAddress, sourceNetworkId).call();
      if (fee) handleReceipt(await (schnoodle as any).methods.payFee(sourceNetworkId).send({ from: selectedAddress, value: fee }));

      // Request the server to call receiveTokens on the Schnoodle contract
      const json = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/ReceiveTokens`, {
        method: 'POST',
        body: JSON.stringify({ address: selectedAddress, sourceNetwork, targetNetwork })
      })).json();

      if (json.status !== 'ok') {
        setServerError(json.body.message);
      }
    } catch (err) {
      handleError(err, setStatus);
    }

    setBusyMessage(null);
  }

  const swapNetworks = async () => {
    await changeSourceNetwork({ value: networksData.targetNetwork });
    await changeTargetNetwork({ value: networksData.sourceNetwork });
  }

  const changeSourceNetwork = async (e: any) => {
    await changeNetwork(e.value, networksData?.targetNetwork, 'sourceNetwork', 'targetNetwork');

    const { sourceNetwork, selectedAddress } = networksData;
    const { schnoodleEth, schnoodleBsc } = contracts;
    let schnoodleSource;
    switch (sourceNetwork) {
      case Network.ethereum:
        schnoodleSource = schnoodleBsc;
        break;
      case Network.bsc:
        schnoodleSource = schnoodleEth;
        break;
      default:
        throw new Error(`Source network ${sourceNetwork} unsupported.`);
    }
    setAmounts({ ...amounts, availableAmount: bigInt(await (schnoodleSource as any).methods.unlockedBalanceOf(selectedAddress).call()) });
  }

  const changeTargetNetwork = async (e: any) => {
    await changeNetwork(e.value, networksData.sourceNetwork, 'targetNetwork', 'sourceNetwork');
  }

  const changeNetwork = async (network: any, counterNetwork: string | null, networkKey: string, counterNetworkKey: string) => {
    localStorage.setItem(networkKey, network);
    if (network === counterNetwork) {
      await changeNetwork(Object.keys(networks).find(key => key !== counterNetwork), network, counterNetworkKey, networkKey);
    } else {
      setNetworksData({...networksData, [networkKey]: network, [counterNetworkKey]: counterNetwork});
    }
    await getInfo()
  }

  const getFee = async (network: any) => {
    // Get the fee that must be paid before receiving tokens on the blockchain
    const json = await (await fetch(`${process.env.REACT_APP_SERVER_URL}/GetFee`, {
      method: 'POST',
      body: JSON.stringify({ network })
    })).json();

    if (json.status === 'ok') {
      return json.body.fee;
    } else {
      throw new Error(json.body.err.message);
    }
  }

  const updateAmount = (e: any) => {
    const value = Number(e.target.value);
    if (!Number.isInteger(value)) return;
    setAmounts({...amounts, amount: value});
  }

  const setAmount = (amount: number) => {
    setAmounts({...amounts, amount: Math.min(Math.floor(amount), scaleDownUnits(amounts.availableAmount))});
  }

  const close = () => {
    clearMessage();
    setAmount(0);
    setShowClose(false);
  }

  const clearMessage = () => {
    setStatus({...status, message: null});
  }

  const getDisplayAccount = (data: INetworkData | undefined) => {
    return data?.selectedAddress ? data.selectedAddress.slice(0, 6) + '...' + data.selectedAddress.slice(-6) : '';
  }

  const styles = {
    valueContainer: () => ({ width: 100, border: 'none', display: 'grid' }),
    singleValue: (base: any) => ({ ...base, color: 'white', }),
    control: (base: any, state: any) => ({ ...base, background: '#070c39', borderRadius: '0.5em', borderWidth: '0px', boxShadow: '0px 12px 7px rgba(0, 0, 0, 0.34)' }),
    dropdownIndicator: (base: any, state: any) => ({ ...base, color: 'white' }),
    menuList: (base: any) => ({ ...base, background: '#070c39', color: 'white' }),
    option: (provided: any, state: any) => ({ ...provided, color: state.isSelected || state.isFocused ? '#dc20bc' : 'white', background: '#070c39' })
  }

  const { Option, SingleValue } = components;  

  const option = (props: any) => (
    <div className="tw-flex">
      <img
        src={`/assets/img/svg/${props.data.value}.svg`}
        className="tw-w-1/4 tw-mr-2"
        alt={props.data.label}
      />
      <span>{props.data.label}</span>
    </div>
  )

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

  const sourceNetworks = Object.keys(networks).map((key) => { return { value: key, label: networks[key].standard } });
  const targetNetworks = sourceNetworks;

  return (
    <div className="tw-font-Roboto tw-flex tw-flex-col tw-min-h-screen tw-bg-violet-900">
    <div className="tw-flex-grow">
        <div className="tw-mx-auto tw-w-full lg:tw-max-w-5xl tw-px-4">
        <div className="lg:tw-grid tw-block">
            <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.BRIDGE}</h1>
            {busyMessage && 
            <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-color tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
                <img src="/assets/img/svg/load.svg" alt="" className="tw-w-16 tw-h-16 tw-mb-8 lg:tw-mb-11 tw-animate-spin" />
                <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{busyMessage}</div>
            </div>
            }
            {showClose ? ( 
                <div className="tw-col-span-7 lg:tw-bg-violet-900 bg-transparent lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl tw-text-white">
                    <div className="tw-flex tw-items-center tw-flex-col tw-text-2xl lg:tw-text-3xl">
                    <div className="tw-text-center tw-mb-9 tw-leading-normal">We sent you <span className="text-main-color tw-font-medium">{tokensPending}</span> <span className="tw-font-bold">{`SNOOD to the ${networksData.targetNetwork} network at address ${getDisplayAccount(networksData)}`}</span></div>
                    <div className="tw-text-lg tw-mb-16 lg:tw-mb-5 tw-text-center">You can track the transaction <a href={networksData.sourceNetwork === Network.bsc ? `http://testnet.bscscan.com/tx/${status.message}` : (`http://rinkeby.etherscan.io/tx/${status.message}`)} target="_blank" rel="noreferrer" className="text-main-color tw-transition-all tw-duration-200 hover:text-main-color hover:tw-underline">here</a></div>
                    <button onClick={close} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-color tw-text-white tw-outline-none focus:tw-outline-none">CLOSE</button>
                    </div>
                </div>
            ) : !serverStatus ? (
                <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
                    <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">Server offline</div>
                </div>
            ) : serverError != null ? (
                <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-violet-900 tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
                    <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{`Remote server error: ${serverError}`}</div>
                </div>
            ) : (
            <div className="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
            <div className="tw-col-span-7 tw-p-9 lg:tw-px-6 tw-rounded-13 lg:bg-violet-900 tw-bg-transparent">
                <div className="tw-flex tw-items-center lg:tw-mb-9 tw-mb-6 tw-flex-col lg:tw-flex-row">
                    <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mb-5 lg:tw-mb-0 tw-p-12 tw-rounded-xl tw-bg-neutral lg:tw-bg-transparent">
                        <div className="tw-font-bold tw-text-xs lg:tw-mb-4 tw-text-white">From</div>
                        <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                            <div>
                              <div className="purplefade tw-opacity-50 tw-bg-base-200 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                                <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(network => network.value === networksData.sourceNetwork)} onChange={changeSourceNetwork} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }}/>
                              </div>
                        </div>
                    </div>
                    <button type="button" onClick={swapNetworks} className="tw-z-0 tw-p-2 bg-color lg:tw-w-1/6 tw-h-10 tw-content-center tw-rounded-lg outline-none focus:outline-none tw--my-4 lg:tw-mt-7 tw-relative lg:tw-static tw-transform tw-rotate-90 lg:tw-transform-none">
                        <img className="tw-block tw-w-5 tw-h-5 tw-mx-auto" src="/assets/img/svg/arrows.svg" alt=""/>
                    </button>
                    <div className="tw-w-full tw-flex tw-items-center tw-flex-col tw-mt-5 tw-mb-5 lg:tw-mt-5 -mt-3 tw-bg-neutral lg:tw-bg-transparent tw-p-12 tw-rounded-xl">
                        <div className="tw-font-bold tw-text-xs lg:tw-mb-4 tw-text-white">To</div>
                        <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                            <div>
                              <div className="purplefade tw-opacity-50 tw-bg-base-200 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                                <Select styles={styles} options={targetNetworks} value={targetNetworks.find(network => network.value === networksData.targetNetwork)} onChange={changeTargetNetwork} components={{ SingleValue: singleValue, Option: singleOption, IndicatorSeparator: () => null }}/>
                              </div>
                        </div>
                    </div>
                </div>
                {tokensPending > 0
                ? <div className="tw-col-span-7 lg:bg-color lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl">
                    <div className="tw-text-center tw-mb-14 tw-leading-normal">
                    <span className="text-main-color tw-font-medium">{scaleDownUnits(tokensPending)}</span> <span className="tw-font-bold">{'SNOOD ready to be received'}</span>
                    </div>
                    <button onClick={receiveTokens} disabled={parseInt(networksData.networkId) !== networks[networksData.targetNetwork].id} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-main-color-hover tw-text-white tw-outline-none focus:tw-outline-none">RECEIVE</button>
                </div>
                : <div className="md:tw-m-auto md:tw-w-1/2">
                    <div className="tw-relative tw-mb-10 tw-flex">
                      <input type="number" min="1" max={scaleDownUnits(amounts.availableAmount)} placeholder={`Max: ${scaleDownUnits(amounts.availableAmount)}`} value={amounts.amount || ''} onChange={updateAmount} className="depositinput" />
                      <button type="button" className="dwmbutton hidesmmd" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount / 4))}>25%</button>
                      <button type="button" className="dwmbutton hidesmmd" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount / 2))}>50%</button>
                      <button type="button" className="dwmbutton hidesmmd" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount * 3 / 4))}>75%</button>
                      <button type="button" className="dwmbutton hidelg" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount / 4))}>&frac14;</button>
                      <button type="button" className="dwmbutton hidelg" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount / 2))}>&frac12;</button>
                      <button type="button" className="dwmbutton hidelg" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount * 3 / 4))}>&frac34;</button>
                      <button type="button" className="maxbuttons" onClick={() => setAmount(scaleDownUnits(amounts.availableAmount))}>Max</button>
                    </div>
                    <button type="button" onClick={sendTokens} disabled={amounts.amount === 0} className="keybn maxbuttons tw-w-full">SEND</button>
                    <div className="tw-col-span-5 tw-rounded-13 lg:tw-px-8 lg:tw-mr-8 lg:tw-pt-10 lg:tw-bg-violet-900 tw-bg-transparent tw-relative">
                      {fee &&
                        <div>
                          <div className="tw-flex tw-justify-center text-main-text tw-mb-7">
                            Receive Fee:
                            <div className="tw-ml-1.5 tw-text-white">{`${scaleDownPrecise(fee, 6)} ${networks[networksData.targetNetwork].symbol}`}</div>
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
            </div>
            )
            }
        </div>
        </div>
    </div>
    <footer className="tw-hidden lg:tw-block tw-bg-violet-900 tw-h-9" />

    <div className="tw-hidden tw-bg-violet-900 mr-20 h-auto p-8 pt-24 pb-0 tw-fixed top-0 left-0 z-30 overflow-y-auto h-full">
        <div className="text-2xl lg:text-3xl mb-16 block tw-text-white">Schnoodle Bridge</div>
        <a className="tw-font-bold tw-text-xl text-main-color tw-mb-8 tw-block" href="/">Main Page</a>
    </div>
    </div>
  );
}

Bridge.displayName = Bridge.name;