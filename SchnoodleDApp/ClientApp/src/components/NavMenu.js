import React, { Component } from 'react';
import { Collapse, Container, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
import { Link } from 'react-router-dom';
import './NavMenu.css';
import { resources } from '../resources';

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
            <NavbarBrand tag={Link} to="/" className="tw-leading-tight tw-uppercase tw-font-bold">{resources.APP_NAME}</NavbarBrand>
                <NavbarToggler onClick={this.toggleNavbar} className="mr-2" />
            <Collapse className="d-sm-inline-flex flex-sm-row-reverse" isOpen={!this.state.collapsed} navbar>
              <ul className="navbar-nav flex-grow">
                <NavItem>
                  <NavLink tag={Link} className="text-light tw-uppercase" to="/" onClick={this.toggleNavbar}>Home</NavLink>
                </NavItem>
                <NavItem>
                  <NavLink tag={Link} className="text-light tw-uppercase" to="/farming" onClick={this.toggleNavbar}>{resources.MOON_FARMING}</NavLink>
                </NavItem>
                <NavItem>
                  <NavLink tag={Link} className="text-light tw-uppercase" to="/mooncontrol" onClick={this.toggleNavbar}>{resources.MOON_CONTROL}</NavLink>
                </NavItem>
              </ul>
            </Collapse>
        </Navbar>
      </header>
    );
  }
}

