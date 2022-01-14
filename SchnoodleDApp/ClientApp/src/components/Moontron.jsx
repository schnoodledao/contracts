import React, { Component } from 'react';
import { resources } from '../resources';
import MoontronV1 from "../contracts/MoontronV1.json";
import getWeb3 from "../getWeb3";

// Third-party libraries
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';

export class Moontron extends Component {
  static displayName = Moontron.name;
  
  constructor(props) {
    super(props);

    this.state = {
      success: false,
      message: null,
      web3: null,
      moontron: null,
      selectedAddress: null,
      getInfoIntervalId: 0,
      blockNumber: 0,
      openHelpModal: false,
      helpTitle: '',
      helpInfo: '',
      helpDetails: ''
    };

    this.mint = this.mint.bind(this);
    this.closeHelpModal = this.closeHelpModal.bind(this);
  }

  async componentDidMount() {
    try {
      const web3 = await getWeb3();
      const moontronDeployedNetwork = MoontronV1.networks[await web3.eth.net.getId()];
      const moontron = new web3.eth.Contract(MoontronV1.abi, moontronDeployedNetwork && moontronDeployedNetwork.address);

      this.setState({ web3, moontron, selectedAddress: web3.currentProvider.selectedAddress }, async () => {
        await this.getInfo();
        const getInfoIntervalId = setInterval(async () => await this.getInfo(), 10000);
        this.setState({ getInfoIntervalId });
      });
    
      window.ethereum.on('accountsChanged', () => window.location.reload(true));
      window.ethereum.on('networkChanged', () => window.location.reload(true));
    } catch (err) {
      alert('Load error. Please check you are connected to the correct network in MetaMask.');
      console.error(err);
    }
  }

  async getInfo() {
    const { web3 } = this.state;

    const blockNumber = await web3.eth.getBlockNumber();

    this.setState({ blockNumber });
  }

  async mint() {
    const { selectedAddress } = this.state;
    const response = await fetch(`nft/mint/${selectedAddress}`);
  }

  //#region Error handling

  async handleResponse(response) {
    if (response.status) {
      this.setState({ success: true, message: response.transactionHash });
    }

    await this.getInfo();
  }

  handleError(err) {
    console.error(err);
    let message = err.message;

    if (err.message.includes('[ethjs-query] while formatting outputs from RPC')) {
      message = JSON.parse(err.message.match('(?<=\')(?:\\\\.|[^\'\\\\])*(?=\')')).value.data.message;
    }

    this.setState({ success: false, message });
    alert(message);
  }

  //#endregion

  //#region Help functions

  openHelpModal(content) {
    this.setState({ helpTitle: content.TITLE, helpInfo: content.INFO, helpDetails: content.DETAILS, openHelpModal: true })
  }

  closeHelpModal() {
    this.setState({ openHelpModal: false })
  }

  //#endregion

  //#region Rendering

  render() {
    const token = 'SNOOD';
    const subtitle1 = 'Build your own NFT.';
    const subtitle2 = 'Build your own Moontron.';

    if (!this.state.web3) {
      return (
        <div className="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
          <div className="h-noheader md:tw-flex">
            <div className="tw-flex tw-items-center tw-justify-center tw-w-full">
              <div className="tw-px-4">
                <img className="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
                <div className="maintitles tw-uppercase">{resources.MOONTRON}</div>
                <div className="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6" />
                <p className="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading">{resources.LOADING}<span>.</span><span>.</span><span>.</span></p>
                <div className="tw-px-4 tw-mt-4 fakebutton">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      );
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

                    <div className="tw-card-actions tw-text-center tw-mx-auto tw-w-full">
                      <form className="tw-justify-center fullhalfwidth tw-mx-auto tw-mt-5">
                        <fieldset>
                          <div className="tw-form-control">
                            <div>
                              <label className="tw-label">
                                <span className="tw-label-text">
                                  Name
                                </span>
                              </label>
                              <div className="tw-relative tw-flex">
                                <input type="text" onChange={this.updateName} className="depositinput" />
                              </div>
                            </div>
                          </div>
                          <div className="tw-mb-3 tw-form-control">
                            <button type="button" className='keybtn maxbuttons' disabled={false} onClick={this.mint}>Mint</button>
                          </div>
                        </fieldset>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="my-5">
                  <p style={{ color: this.state.success ? 'green' : 'red' }}>{this.state.message}</p>
                </div>
              </div>
            </div>
          </div>
      
          <div>
            <Modal open={this.state.openHelpModal} onClose={this.closeHelpModal} center classNames={{ overlay: 'customOverlay', modal: 'customModal' }}>
              <h1>{this.state.helpTitle}</h1>
              <p>{this.state.helpInfo}</p>
              <br />
              <p>{this.state.helpDetails}</p>
            </Modal>
          </div>
        </div>
      </div>
    );
  }

  //#endregion
}
