// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { Collapse, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink } from 'reactstrap';
// @ts-ignore
import { Link } from 'react-router-dom';
import './NavMenu.css';
import { bridge, farming, moontron } from '../resources';
import getWeb3 from '../getWeb3';
// ReSharper restore InconsistentNaming

const NavMenu: React.FC<{}> = () => {
  const [collapsed, setCollapsed] = React.useState(true);
  const [account, setAccount] = React.useState(null);
  const toggleNavbar = () => {
    setCollapsed(!collapsed);
  }

  React.useEffect(() => {
    const fetchData = async () => {
        const web3 = await getWeb3();
        (window as any).ethereum.on('accountsChanged', () => window.location.reload());
        setAccount((web3 as any).currentProvider.selectedAddress);
    }
    fetchData();
    return () => {}
  },[])

  const connect = async () => {
    const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    let account = null;

    if (accounts.length > 0) {
      account = accounts[0];
      localStorage.setItem('account', account);
    }

    setAccount(account);
  }

  return (
    <header>
    <Navbar className="navbar-expand-sm navbar-toggleable-sm tw-bg-neutral tw-text-neutral-content tw-font-roboto tw-px-1 md:tw-px-4" dark>
        <NavbarBrand tag={Link} to="/" className="tw-leading-tight tw-uppercase tw-font-bold">
        <img className="w-40 h-auto" src="/assets/img/svg/logo-schnoodle.svg" alt="Schnoodle logo" />
        </NavbarBrand>
        <NavbarToggler onClick={toggleNavbar} className="mr-2" />
        <Collapse className="d-sm-inline-flex flex-sm-row-reverse" isOpen={!collapsed} navbar>
        <ul className="navbar-nav flex-grow">
            <NavItem>
            <NavLink tag={Link} className="text-light tw-uppercase" to="/" onClick={toggleNavbar}>Home</NavLink>
            </NavItem>
            <NavItem>
            <NavLink tag={Link} className="text-light tw-uppercase" to="/bridge" onClick={toggleNavbar}>{bridge.BRIDGE}</NavLink>
            </NavItem>
            <NavItem>
            <NavLink tag={Link} className="text-light tw-uppercase" to="/farming" onClick={toggleNavbar}>{farming.MOON_FARMING}</NavLink>
            </NavItem>
            <NavItem>
            <NavLink tag={Link} className="text-light tw-uppercase" to="/mooncontrol" onClick={toggleNavbar}>{farming.MOON_CONTROL}</NavLink>
            </NavItem>
            <NavItem>
            <NavLink tag={Link} className="text-light tw-uppercase" to="/moontron" onClick={toggleNavbar}>{moontron.MOONTRON}</NavLink>
            </NavItem>
        </ul>
        </Collapse>
        {account == null
        ? <button onClick={connect}>Connect</button>
        : <div>{account.slice(0, 6) + '...' + account.slice(-6)}</div>
        }
    </Navbar>
    </header>
  );
}


NavMenu.displayName = NavMenu.name;
export default NavMenu;