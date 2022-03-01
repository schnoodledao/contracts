import React, { Component } from 'react';
import { Collapse, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
import { Link } from 'react-router-dom';
import './NavMenu.css';
import { general, bridge, farming, moontron } from '../resources';

export class NavMenu extends Component {
  static displayName = NavMenu.name;

  constructor (props) {
    super(props);

    this.toggleNavbar = this.toggleNavbar.bind(this);
    this.state = {
      collapsed: true
    };
  }

  toggleNavbar () {
    this.setState({
      collapsed: !this.state.collapsed
    });
  }

  render () {
    return (
        <header>
        <Navbar className="navbar-expand-sm navbar-toggleable-sm tw-bg-neutral tw-text-neutral-content tw-font-roboto tw-px-1 md:tw-px-4" dark>
            <NavbarBrand tag={Link} to="/" className="tw-leading-tight tw-uppercase tw-font-bold">{general.APP_NAME}</NavbarBrand>
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
                <NavItem>
                  <NavLink tag={Link} className="text-light tw-uppercase" to="/moontron" onClick={this.toggleNavbar}>{moontron.MOONTRON}</NavLink>
                </NavItem>
              </ul>
            </Collapse>
        </Navbar>
      </header>
    );
  }
}
