// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import NavMenu from './NavMenuTS';
// ReSharper disable InconsistentNaming

export class Layout extends Component {
  static displayName = Layout.name;

  render () {
    return (
      <div className="">
        <NavMenu />
        {this.props.children}
      </div>
    );
  }
}
