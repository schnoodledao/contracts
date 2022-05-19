// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
// @ts-ignore
import NavMenu from './NavMenu.tsx';
// ReSharper disable InconsistentNaming

export class Layout extends Component {
  static displayName = Layout.name;

  render () {
    return (
      <div className="">
        <NavMenu />
        {(this.props as any).children}
      </div>
    );
  }
}
