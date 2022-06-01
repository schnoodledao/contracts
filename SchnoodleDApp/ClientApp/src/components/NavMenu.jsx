// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { Collapse, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
import { Link } from 'react-router-dom';
import './NavMenu.css';
import { bridge, farming, moontron } from '../resources';
// ReSharper restore InconsistentNaming

export class NavMenu extends Component {
  static displayName = NavMenu.name;

  constructor (props) {
    super(props);

    this.state = {
      collapsed: true,
      account: null
    };

    this.toggleNavbar = this.toggleNavbar.bind(this);
    this.connect = this.connect.bind(this);
  }

  toggleNavbar () {
    this.setState({
      collapsed: !this.state.collapsed
    });
  }

  async componentDidMount() {
    window.ethereum.on('accountsChanged', () => window.location.reload(true));
    await this.connect();
  }

  async connect() {
    await window.ethereum.enable();
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    this.setState({ account: accounts.length > 0 ? accounts[0] : null });
  }

  render() {
    return (
      <header>
        <Navbar className="navbar-expand-sm navbar-toggleable-sm tw-bg-neutral tw-text-neutral-content tw-font-roboto tw-px-1 md:tw-px-4" dark>
          <NavbarBrand tag={Link} to="/" className="tw-leading-tight tw-uppercase tw-font-bold">
            <img className="tw-w-40 tw-h-auto" src="/assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
          </NavbarBrand>
          <NavbarToggler onClick={this.toggleNavbar} className="mr-2" />
          <Collapse className="d-sm-inline-flex flex-sm-row-reverse" isOpen={!this.state.collapsed} navbar>
            <ul className="navbar-nav flex-grow">
              <NavItem>
                <NavLink tag={Link} className="text-light tw-uppercase" to="/" onClick={this.toggleNavbar}>Home</NavLink>
              </NavItem>
              <NavItem>
                <NavLink tag={Link} className="text-light tw-uppercase" to="/bridge" onClick={this.toggleNavbar}>{bridge.BRIDGE}</NavLink>
              </NavItem>
              <NavItem>
                <NavLink tag={Link} className="text-light tw-uppercase" to="/farming" onClick={this.toggleNavbar}>{farming.MOON_FARMING}</NavLink>
              </NavItem>
              <NavItem>
                <NavLink tag={Link} className="text-light tw-uppercase" to="/mooncontrol" onClick={this.toggleNavbar}>{farming.MOON_CONTROL}</NavLink>
              </NavItem>
            {/*  <NavItem>*/}
            {/*    <NavLink tag={Link} className="text-light tw-uppercase" to="/moontron" onClick={this.toggleNavbar}>{moontron.MOONTRON}</NavLink>*/}
            {/*  </NavItem>*/}
            </ul>
          </Collapse>
          {this.state.account == null
            ? <button onClick={this.connect}>Connect</button>
            : <div>{this.state.account.slice(0, 6) + '...' + this.state.account.slice(-6)}</div>
          }
        </Navbar>
      </header>
    );
  }
}
