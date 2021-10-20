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
        <Navbar className="navbar mb-2 shadow-lg bg-neutral text-neutral-content" light>
          <Container className="m-auto">
            <div class="flex-1 px-2 mx-2">
              <span class="text-lg font-bold">
                <NavbarBrand tag={Link} to="/">Schnoodle X</NavbarBrand>
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
                        <NavLink tag={Link} className="" to="/staking">Staking</NavLink>
                      </NavItem>
                    </ul>
                  </Collapse>
                <div class="flex-none">
                  <NavbarToggler onClick={this.toggleNavbar} className="btn btn-square btn-ghost" />
                </div>
              </div>
            </div>
          </Container>
        </Navbar>
      </header>
    );
  }
}
