import React, { Component } from 'react';
import { Collapse, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
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
        <Navbar className="navbar mb-2 shadow-lg bg-neutral text-neutral-content font-roboto" light>
          <div className="container flex flex-wrap justify-between items-center mx-auto">
            <div class="flex">
              <span class="text-lg font-bold">
                <NavbarBrand tag={Link} to="/" className="leading-tight uppercase">{resources.APP_NAME}</NavbarBrand>
              </span>
            </div>
            <button onClick={this.toggleNavbar} type="button" class="inline-flex items-center p-2 ml-3 text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" >
              <span class="sr-only">Open main menu</span>
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path></svg>
              <svg class="hidden w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
            </button>
            <Collapse className="hidden w-full md:block md:w-auto" isOpen={!this.state.collapsed} navbar>
              <ul class="flex flex-col mt-4 md:flex-row md:space-x-2 md:mt-0 md:text-sm md:font-medium">
                <NavItem className="btn btn-ghost rounded-btn">
                  <NavLink tag={Link} className="" to="/">Home</NavLink>
                </NavItem>
                <NavItem className="btn btn-ghost rounded-btn">
                  <NavLink tag={Link} className="" to="/farming">{resources.MOON_FARMING}</NavLink>
                </NavItem>
                <NavItem className="btn btn-ghost rounded-btn">
                  <NavLink tag={Link} className="" to="/mooncontrol">{resources.MOON_CONTROL}</NavLink>
                </NavItem>
              </ul>
            </Collapse>
          </div>
        </Navbar>
      </header>
    );
  }
}
