// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { NavMenu } from './NavMenu';
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
