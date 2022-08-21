// ReSharper disable InconsistentNaming
import React, { useEffect, useState, useRef } from 'react';
import { general, moontron as resources } from '../resources';
import MoontronV1 from '../contracts/MoontronV1.json';
import { handleError, getWeb3 } from '../helpers';
import { Viewer } from '../viewer/viewer';
import { IStatus } from '../types';

// Third-party libraries
import 'react-responsive-modal/styles.css';
import { Puff } from 'react-loader-spinner';
import queryString from 'query-string';
import { Contract } from 'web3-eth-contract';
// ReSharper restore InconsistentNaming

// global fetch: false

interface INftAssetItem {
  id: number,
  assetHash: string,
}

interface IConfig {
  [key: string]: {
    [key: string]: {
      optional: [],
      required: [],
    }
  },
}

const Moontron: React.FC = () => {
  const [status, setStatus] = useState<IStatus>({ success: true, message: null });
  const [busy, setBusy] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<boolean[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [assetConfigs, setAssetConfigs] = useState<IConfig>({});
  const [nftAssetItem, setNftAssetItem] = useState<INftAssetItem | null>(null);
  const [viewer, setViewer] = useState<Viewer>();
  const viewerRef = useRef<HTMLDivElement>(null);

  const hash = window.location.hash ? queryString.parse(window.location.hash) : {};
  const options = {
    kiosk: Boolean(hash.kiosk),
    model: hash.model || '',
    preset: hash.preset || '',
    cameraPosition: hash.cameraPosition ? (hash as any).cameraPosition.split(',').map(Number) : null
  };

  const [moontron, setMoontron] = useState<Contract>();
  const [serviceAccount, setServiceAccount] = useState<string>();
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState<string>();
  const [mintFee, setMintFee] = useState<number>();

  const web3 = getWeb3();
  const selectedAddress = web3.currentProvider.selectedAddress;

  useEffect(() => {
    const initialize = async () => {
      try {
        const moontronNetwork = MoontronV1.networks[await web3.eth.net.getId()];
        setMoontron(new web3.eth.Contract(MoontronV1.abi, moontronNetwork.address));
        moontron; //TODO
        setGatewayBaseUrl(await (await fetch('nft/gatewaybaseurl')).text());
        setServiceAccount(await (await fetch('nft/serviceaccount')).text());
        setMintFee(Number(await (await fetch('nft/mintfee')).text()));
        setAssetConfigs(await (await fetch('nft/assetconfigs')).json());
        setViewer(new Viewer(viewerRef.current, options));
      } catch (err) {
        handleError(err as Error, setStatus);
      }
    }

    initialize()
  }, [viewerRef])

  const updateAssetConfig = (e: any) => {
    const [selectedAsset, selectedConfig] = e.target.value.split(',');
    setSelectedAsset(selectedAsset);
    setSelectedConfig(selectedConfig);
  }

  const updateSelectedComponent = (component: any) => {
    selectedComponents[component] = !selectedComponents[component];
    setSelectedComponents(selectedComponents);
  }

  const generateAsset = async () => {
    try {
      setBusy(true);

      // Request payment for the NFT upfront
      const txn = await web3.eth.sendTransaction({ from: selectedAddress, to: serviceAccount, value: mintFee });

      // Generate the asset sending proof of payment (PoP), and the desired list of components
      const componentsQuery = Object.keys(selectedComponents).filter((component: any) => selectedComponents[component]).map((component) => `components=${component}`).join('&');
      const nftAssetItem = await (await fetch(`nft/generateasset/${selectedAsset}/${selectedConfig}/${selectedAddress}/${await (web3 as any).eth.getChainId()}/${txn.transactionHash}?${componentsQuery}`)).json();

      // Fetch the GLB file from its pinned URL on IPFS
      const assetUrl = gatewayBaseUrl + nftAssetItem.assetHash;
      const file = new File([(await (await fetch(assetUrl)).blob())], `${selectedAsset}.glb`, { type: 'model/gltf-binary' });

      // Load the GLB file into the 3D viewer
      const assetMap = new Map();
      assetMap.set(assetUrl, file);
      await viewer?.load(nftAssetItem.assetHash, gatewayBaseUrl, assetMap);

      setNftAssetItem(nftAssetItem);
    } catch (err) {
      handleError(err as Error, setStatus);
    }
    setBusy(false);
  }

  const mint = async () => {
    try {
      if (!nftAssetItem) return;
      setBusy(true);

      // Build a preview image of the 3D asset to include in the NFT metadata
      const data = new FormData();
      const type = 'image/png';
      data.append('image', new File([await (await fetch(viewer?.encode(type))).arrayBuffer()], 'Preview.png', { type }));
      const receipt = await (await fetch(`nft/mint/${nftAssetItem.id}`, { method: 'POST', body: data })).text();

      // Nullify the generated asset item on a successful mint
      setNftAssetItem(null);
      setStatus({ success: true, message: receipt });
    } catch (err) {
      handleError(err as Error, setStatus);
    }
    setBusy(false);
  }

  //#endregion

  //#region Rendering

  const subtitle1 = 'Build your own NFT.';
  const subtitle2 = 'Build your own Moontron.';

  if (!web3) {
    return (
      <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div className="h-noheader md:tw-flex">
          <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div className="tw-px-4">
              <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
              <div className="maintitles tw-uppercase">{resources.MOONTRON}</div>
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
              <h1 className="tw-mt-10 tw-mb-2 maintitles tw-leading-tight tw-text-center md:tw-text-left tw-uppercase">{resources.MOONTRON}</h1>
              <p className="tw-my-2 tw-text-2xl md:tw-text-3xl tw-leading-tight titlefont tw-w-2/3 md:tw-w-full tw-m-auto md:tw-mx-0 textfade tw-from-green-400 tw-to-purple-500">
                <span className="tw-block md:tw-hidden tw-text-center">{subtitle1}<br />{subtitle2}</span>
                <span className="tw-hidden md:tw-block tw-text-left">{subtitle1} {subtitle2}</span>
              </p>

              <div className="tw-card tw-shadow-sm tw-border-purple-500 tw-border-4 tw-rounded-2xl tw-text-accent-content tw-mt-5 tw-mb-5 tw-container-lg">
                <div className="tw-card-body tw-my-6 md:tw-my-10 tw-rounded-4xl">
                  <div className="tw-divider tw-mt-10">
                    <h3 className="sectiontitle tw-text-2xl md:tw-text-3xl tw-leading-tight">Mint NFT</h3>
                  </div>

                  <div className="tw-grid tw-mt-4">
                    {busy && (
                      <div className="tw-overlay tw-z-20">
                        <div className="overlayloader tw-flex tw-flex-col tw-items-center tw-justify-center ">
                          <div>
                            <Puff color="#00BFFF" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="tw-card-actions tw-text-center tw-mx-auto tw-w-full">
                      <form className="tw-w-full tw-mt-5">
                        <fieldset>
                          <div className="tw-form-control space-y-6 sm:space-y-5">
                            <div className="tw-sm:grid tw-sm:grid-cols-3 tw-sm:gap-4 tw-sm:items-start tw-sm:border-t tw-sm:border-gray-200 tw-sm:pt-5">
                              <div>
                                <select value={[selectedAsset, selectedConfig]} onChange={updateAssetConfig} className="tw-text-xl tw-leading-6 tw-select tw-select-bordered tw-select-secondary tw-w-full tw-max-w-xs tw-text-white">
                                  <option className="tw-text-xl">Select Asset</option>
                                  {Object.keys(assetConfigs).map((assetName) => {
                                    return Object.keys(assetConfigs[assetName as any]).map((configName) => {
                                      return (<option key={configName} value={[assetName, configName]} className="tw-text-xl">{`${assetName} - ${configName}`}</option>);
                                    });
                                  })}
                                </select>
                                <fieldset>
                                  {selectedAsset && assetConfigs[selectedAsset as any][selectedConfig]['optional'].map((component: any) => {
                                    return (
                                      <div key={component}>
                                        <input type="checkbox" id={component} value={component} checked={selectedComponents[component]} onChange={() => updateSelectedComponent(component)} />
                                        <label htmlFor={component} className="tw-text-xl tw-text-white">{component}</label>
                                      </div>
                                    );
                                  })}
                                </fieldset>
                              </div>
                            </div>
                          </div>

                          <div ref={viewerRef} className="viewer tw-max-w-6xl tw-mx-auto" />

                          <div className="tw-mb-3 tw-form-control tw-w-full">
                            <button type="button" className="keybtn nftbtn maxbuttons" disabled={selectedConfig == null} onClick={generateAsset}>Generate</button>
                          </div>
                          <div className="tw-mb-3 tw-form-control tw-w-full">
                            <button type="button" className="keybtn nftbtn maxbuttons" disabled={nftAssetItem == null} onClick={mint}>Mint</button>
                          </div>
                        </fieldset>
                      </form>
                    </div>
                  </div>
                </div>
              </div>

              <div className="my-5">
                <p style={{ color: status.success ? "green" : "red" }}>{status.message}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  //#endregion
}

Moontron.displayName = Moontron.name;
export default Moontron;
