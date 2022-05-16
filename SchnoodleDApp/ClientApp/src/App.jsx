import React, { Component, Suspense } from 'react';
import { Route } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './components/Home';

import './custom.css'

const Bridge = React.lazy(() => import('./components/Bridge'));
const Farming = React.lazy(() => import('./components/Farming'));
const MoonControl = React.lazy(() => import('./components/MoonControl'));
const Moontron = React.lazy(() => import('./components/Moontron'));

export default class App extends Component {
  static displayName = App.name;

  render () {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Layout>
          <Route exact path='/' component={Home} />
          <Route path='/bridge' component={Bridge} />
          <Route path='/farming' component={Farming} />
          <Route path='/mooncontrol' component={MoonControl} />
          <Route path='/moontron' component={Moontron} />
        </Layout>
      </Suspense>
    );
  }
}
