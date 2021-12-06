import React, { Component } from 'react';
import { Collapse, Container, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
import { Link } from 'react-router-dom';
import './NavMenu.css';

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
          <div className="m-auto w-full">
            <div class="flex-1 px-2 mx-2">
              <span class="text-lg font-bold">
                <NavbarBrand tag={Link} to="/" className="leading-tight uppercase">Schnoodle X</NavbarBrand>
              </span>
              </div>
              <div class="flex-none hidden px-2 mx-2 lg:flex">
                <div class="flex items-stretch">
                  <Collapse className="d-sm-inline-flex flex-sm-row-reverse" isOpen={!this.state.collapsed} navbar>
                    <ul className="navbar-nav flex-grow">
                      <NavItem className="btn btn-ghost  rounded-btn">
                        <NavLink tag={Link} className="" to="/">Home</NavLink>
                      </NavItem>
                      <NavItem className="btn btn-ghost rounded-btn">
                        <NavLink tag={Link} className="" to="/farming">Yield Farming</NavLink>
                      </NavItem>
                    </ul>
                  </Collapse>
                <div class="flex-none">
                  <NavbarToggler onClick={this.toggleNavbar} />
                </div>
              </div>
            </div>
          </div>
        </Navbar>
      </header>
    );
  }
}
