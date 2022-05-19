// ReSharper disable InconsistentNaming
import React, { useState, useEffect } from 'react';
import { bridge as resources } from '../resources';

import SchnoodleV1 from '../contracts/SchnoodleV1.json';
import Schnoodle from '../contracts/SchnoodleV9.json';
import getWeb3 from '../getWeb3';
// @ts-ignore
import { initializeHelpers, handleError, scaleUpUnits, scaleDownUnits, scaleDownPrecise, createEnum } from '../helpers.tsx';

// Third-party libraries
import Web3 from 'web3';
import Select from 'react-select';

const Network : {[key: string]: string} = createEnum(['ethereum', 'bsc']);
// ReSharper restore InconsistentNaming

// global fetch: false
interface INetwork {
    name: string,
    id: number,
    url: any,
    standard: string,
    symbol: string,
    rpcUrls: string[]
}
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

interface IContracts {
    web3Eth: Web3,
    web3Bsc: Web3,
    schnoodleEthNetwork: any,
    schnoodleEth: any,
    schnoodleBscNetwork: any,
    schnoodleBsc: any
}

interface INetworkInfo {
    web3: Web3,
    networkId: string,
    schnoodle: any,
    sourceNetwork: string
    targetNetwork: string
    selectedAddress: string
    amount?: number | null
}

interface IStatus {
  success: boolean,
  message: string
}

export default function Bridge() {
  const [busyMessage, setBusyMessage] = useState <string | null>();
  const [tokensPending, setTokensPending] = useState <number>();
  const [tokensReceived, setTokensReceived] = useState <number>();
  const [amount, setAmount] = useState (0);
  const [serverError, setServerError] = useState (false);
  const [showClose, setShowClose] = useState (false);
  const [fee, setFee] = useState (0);
  const [data, setData] = useState <INetworkInfo>();
  const [serverStatus, setServerStatus] = useState (false);
  const [status, setStatus] = useState <IStatus>();
  const [getInfoIntervalId, setGetInfoIntervalId] = useState <NodeJS.Timer | undefined>();
  const [contracts, setContracts] = useState <IContracts | null>();

  useEffect (() => {
    if (data) {
      getInfo();
      const getInfoIntervalId = setInterval(async () => await getInfo(), 10000);
      setGetInfoIntervalId(getInfoIntervalId);
    }
  }, [data])

  useEffect (() => {
    if (contracts) {
      updateWeb3();
    }
  }, [contracts])

  useEffect (() => {
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
    if (!contracts){
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

    setData({
      web3: web3,
      networkId: networkId,
      schnoodle: schnoodle,
      sourceNetwork: localStorage.getItem('sourceNetwork') ?? sourceNetwork,
      targetNetwork: localStorage.getItem('targetNetwork') ?? "",
      selectedAddress: selectedAddress
    })
    if (callback) {
      callback();
    }
  }

  const getInfo = async () => {
    let serverStatus = false;
    try {
      serverStatus = (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/Alive`)).ok;

      if (serverStatus) {
        const { selectedAddress, sourceNetwork, targetNetwork } = data;

        if (selectedAddress && sourceNetwork && targetNetwork) {
          const json = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/GetTokensPending`, {
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
            params: [{ chainId: data?.web3.utils.toHex(network.id) }]
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
                chainId: data?.web3.utils.toHex(network.id),
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
      await switchNetwork(networks[data.sourceNetwork], async () => {
        try {
          const { amount, schnoodle, selectedAddress, targetNetwork } = data;
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
      const { schnoodle, selectedAddress, sourceNetwork, targetNetwork } = data;
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

  const swapNetworks = async (e: any) => {
    const target = data.targetNetwork;
    const source = data.sourceNetwork;
    await changeNetwork(target, source, 'sourceNetwork', 'targetNetwork');
    await changeNetwork(source, target, 'targetNetwork', 'sourceNetwork');
  }

  const changeSourceNetwork = async (e: any) => {
    await changeNetwork(e.value, data.targetNetwork, 'sourceNetwork', 'targetNetwork');
  }

  const changeTargetNetwork = async (e: any) => {
    await changeNetwork(e.value, data.sourceNetwork, 'targetNetwork', 'sourceNetwork');
  }

  const changeNetwork = async (network: any, counterNetwork: string | null, networkKey: string, counterNetworkKey: string) => {
    localStorage.setItem(networkKey, network);
    if (network === counterNetwork) {
      await changeNetwork(Object.keys(networks).find(key => key !== counterNetwork), network, counterNetworkKey, networkKey);
    }
    setData({...data, [networkKey]: network, [counterNetworkKey]: counterNetwork});
    await getInfo()
  }

  const getFee = async (network: any) => {
    // Get the fee that must be paid before receiving tokens on the blockchain
    const json = await (await fetch(`http://${process.env.REACT_APP_SERVER_URL}/GetFee`, {
      method: 'POST',
      body: JSON.stringify({ network })
    })).json();

    if (json.status === 'ok') {
      return json.body.fee;
    } else {
      throw new Error(json.body.err.message);
    }
  }

  const updateAmount = async (e: any) => {
    const amount = Number(e.target.value);
    if (!Number.isInteger(amount)) return;
    setAmount(amount);
  }

  const handleFAQ = () => {
    localStorage.setItem('info', 'faq');
  }

  const handleGuide = () => {
    localStorage.setItem('info', 'guide');
  }

  const close = () => {
    clearMessage();
    setAmount(0);
    setTokensReceived(0);
    setShowClose(false);
  }

  const clearMessage = () => {
    setStatus({...status, message: null});
  }

  const getDisplayAccount = (data: INetworkInfo | undefined) => {
    return data?.selectedAddress ? data.selectedAddress.slice(0, 6) + '...' + data.selectedAddress.slice(-6) : '';
  }

  const styles = {
    valueContainer: () => ({ width: 60 }),
    singleValue: (base: any) => ({ ...base, color: '#dc20bc' }),
    control: (base: any, state: any) => ({ ...base, background: '#070c39', border: 'none' }),
    dropdownIndicator: (base: any) => ({ ...base, color: '#dc20bc' }),
    menuList: (base: any) => ({ ...base, background: '#070c39', color: '#dc20bc' }),
    option: (provided: any, state: any) => ({ ...provided, color: state.isSelected || state.isFocused ? '#dc20bc' : '#6f1860', background: '#070c39' })
  }


  const sourceNetworks = Object.keys(networks).map((key) => { return { value: key, label: networks[key].standard } });
  const targetNetworks = sourceNetworks;

  return (
    <div className="tw-font-Roboto tw-flex tw-flex-col tw-min-h-screen tw-bg-violet-900">
    <div className="lg:tw-py-16 tw-py-10 tw-flex-grow">
        <div className="tw-mx-auto tw-w-full lg:tw-max-w-5xl tw-px-4">
        <div className="lg:tw-grid lg:tw-grid-cols-12 tw-block">
            <div className="tw-col-span-5 tw-rounded-13 lg:tw-px-8 lg:tw-mr-8 lg:tw-py-10 lg:tw-bg-violet-900 tw-bg-transparent tw-relative">
            <div className="tw-text-3xl lg:tw-mb-8 tw-mb-4 tw-bg-gradient-to-r tw-from-purple-500 tw-to-purple-500">Schnoodle Bridge</div>
            <div className="lg:tw-mb-8 tw-mb-4 tw-text-white">The bridge allows to exchange ERC20 tokens for BEP20 tokens as well as BEP20 for ERC20</div>
            <a className="tw-font-bold text-main-color lg:tw-block tw-mb-8 tw-text-xl tw-transition-all tw-duration-200 hover:tw-text-main-color-hover" href="/info" onClick={() => handleGuide()}>Token exchange guide</a>
            <a className="tw-font-bold text-main-color lg:tw-block tw-mb-8 tw-hidden tw-text-xl tw-transition-all tw-duration-200 hover:tw-text-main-color-hover" href="/info" onClick={() => handleFAQ()}>FAQ</a>
            {fee &&
                <div>
                <div className="tw-flex tw-font-bold tw-text-purple-500 lg:tw-mb-8 tw-mb-2 tw-text-xl tw-items-center">Fees</div>
                <div className="tw-flex text-main-text tw-mb-7">
                    Receive:
                    <div className="tw-ml-1.5 tw-text-white">{`${scaleDownPrecise(fee, 6)} ${networks[data.targetNetwork].symbol}`}</div>
                </div>
                </div>
            }
            </div>
            {busyMessage && 
            <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-xl lg:bg-color tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-mt-14 lg:tw-mt-0">
                <img src="/assets/img/svg/load.svg" alt="" className="tw-w-16 tw-h-16 tw-mb-8 lg:tw-mb-11 tw-animate-spin" />
                <div className="tw-text-2xl lg:tw-text-3xl tw-leading-snug tw-text-white tw-text-center">{busyMessage}</div>
            </div>
            }
            {showClose ? ( 
                <div className="tw-col-span-7 lg:tw-bg-violet-900 bg-transparent lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl tw-text-white">
                    <div className="tw-flex tw-items-center tw-flex-col tw-text-2xl lg:tw-text-3xl">
                    <div className="tw-text-center tw-mb-9 tw-leading-normal">We sent you <span className="text-main-color tw-font-medium">{tokensPending}</span> <span className="tw-font-bold">{`SNOOD to the ${data.targetNetwork} network at address ${getDisplayAccount(data)}`}</span></div>
                    <div className="tw-text-lg tw-mb-16 lg:tw-mb-5 tw-text-center">You can track the transaction <a href={data.sourceNetwork === Network.bsc ? `http://testnet.bscscan.com/tx/${status.message}` : (`http://rinkeby.etherscan.io/tx/${status.message}`)} target="_blank" rel="noreferrer" className="text-main-color tw-transition-all tw-duration-200 hover:text-main-color hover:tw-underline">here</a></div>
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
            <div className="tw-col-span-7 lg:tw-px-6 lg:tw-py-10 tw-rounded-13 lg:bg-violet-900 tw-bg-transparent">
                <div className="tw-flex tw-items-center lg:tw-mb-9 tw-mb-6 tw-flex-col lg:tw-flex-row">
                    <div className="tw-w-full lg:tw-w-5/12 tw-p-12 tw-rounded-xl tw-bg-neutral lg:tw-bg-transparent">
                        <div className="tw-font-bold tw-text-xs lg:tw-mb-4 text-main-color">From</div>
                        <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-4 tw-bg-neutral tw-rounded-lg">
                            <div>
                                <div className="tw-text-gray-400 tw-opacity-50 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                                <Select styles={styles} options={sourceNetworks} value={sourceNetworks.find(network => network.value === data.sourceNetwork)} onChange={changeSourceNetwork} components={{ IndicatorSeparator: () => null }}/>
                            </div>
                            <div className="tw-rounded-full tw-w-1/6 tw-h-1/6 tw-flex tw-justify-center tw-items-center"><img src="/assets/img/png/logo-krypto.png" alt=""/></div>
                        </div>
                    </div>
                    <button onClick={swapNetworks} className="tw-p-2 bg-color tw-w-10 tw-h-10 lg:tw-mx-6 tw-content-center tw-rounded-lg outline-none focus:outline-none tw--my-4 lg:tw-mt-7 tw-relative tw-z-20 lg:tw-static tw-transform tw-rotate-90 lg:tw-transform-none">
                        <img className="tw-block tw-w-5 tw-h-5 tw-mx-auto" src="/assets/img/svg/arrows.svg" alt=""/>
                    </button>
                    <div className="tw-w-full lg:tw-w-5/12 tw-relative -mt-3 lg:tw-static tw-bg-neutral lg:tw-bg-transparent tw-p-12 tw-rounded-xl">
                        <div className="tw-font-bold tw-text-xs lg:tw-mb-4 text-main-color">To</div>
                        <div className="tw-flex tw-items-center tw-justify-between lg:tw-p-5 tw-bg-neutral tw-rounded-lg">
                            <div>
                                <div className="tw-text-gray-400 tw-opacity-50 tw-uppercase tw-text-xl tw-font-bold">SNOOD</div>
                                <Select styles={styles} options={targetNetworks} value={targetNetworks.find(network => network.value === data.targetNetwork)} onChange={changeTargetNetwork} components={{ IndicatorSeparator: () => null }}/>
                            </div>
                            <div className="tw-w-1/6 tw-h-1/6 tw-flex tw-justify-center tw-items-center tw-rounded-full"><img src="/assets/img/png/logo-krypto.png" alt=""/></div>
                        </div>
                    </div>
                </div>
                <div className="tw-opacity-50 tw-text-white md:tw-text-base tw-mb-4 tw-tracking-wide tw-text-xs">Details</div>
                {tokensPending > 0
                ? <div className="tw-col-span-7 lg:bg-color lg:tw-py-40 tw-pt-10 lg:tw-px-14 tw-px-4 tw-rounded-xl tw-bg-transparent tw-flex tw-items-center tw-flex-col tw-justify-center tw-text-2xl lg:tw-text-3xl">
                    <div className="tw-text-center tw-mb-14 tw-leading-normal">
                    <span className="text-main-color tw-font-medium">{scaleDownUnits(tokensPending)}</span> <span className="tw-font-bold">{'SNOOD ready to be received'}</span>
                    </div>
                    <button onClick={receiveTokens} disabled={parseInt(data.networkId) !== networks[data.targetNetwork].id} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-main-color-hover tw-text-white tw-outline-none focus:tw-outline-none">RECEIVE</button>
                </div>
                : <div>
                    <div className="tw-flex tw-flex-col tw-border-solid tw-mb-10 lg:tw-mb-16">
                    <input type="number" min="1" placeholder="Amount" value={amount || ''} onChange={updateAmount} className="tw-w-full tw-text-white tw-bg-neutral tw-rounded-md tw-text-sm tw-border tw-border-border tw-p-3.5 tw-font-medium tw-outline-none focus:tw-outline-none" />
                    </div>
                    <button onClick={sendTokens} disabled={amount === 0} className="tw-text-sm tw-max-w-xs tw-w-full tw-mx-auto tw-h-12 bg-color tw-block tw-rounded tw-transition-all tw-duration-200 hover:bg-main-color-hover tw-text-white tw-outline-none focus:tw-outline-none">SEND</button>
                </div>
                }
                <div className="tw-text-center tw-mt-2.5">
                    <p style={{ color: status?.success ? 'green' : 'red' }}>{status?.message}</p>
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
        <a href="/info" className="tw=font-bold tw-text-xl tw-text-second-color tw-mb-8 tw-block" onClick={() => handleGuide()}>Token exchange guide</a>
        <a href="/info" className="tw-font-bold tw-text-xl tw-text-second-color tw-mb-8 tw-block" onClick={() => handleFAQ()}>FAQ</a>
    </div>
    </div>
  );
}

Bridge.displayName = Bridge.name;

