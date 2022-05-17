// ReSharper disable InconsistentNaming
import React, { Component } from 'react';
import { Container } from 'reactstrap';
import { NavMenu } from './NavMenu';
// ReSharper disable InconsistentNaming

export class Layout extends Component {
  static displayName = Layout.name;

  render () {
    return (
      <div className="">
        <NavMenu />
        <Container>
          {this.props.children}
        </Container>
      </div>
    );
  }
}
