import React, { Component } from 'react';
import { Route } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Farming } from './components/Farming';
import { MoonControl } from './components/MoonControl';

import './custom.css'

export default class App extends Component {
  static displayName = App.name;

  render () {
    return (
      <Layout>
        <Route exact path='/' component={Home} />
        <Route path='/farming' component={Farming} />
        <Route path='/mooncontrol' component={MoonControl} />
      </Layout>
    );
  }
}
