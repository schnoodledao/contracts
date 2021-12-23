import React, { Component } from 'react';
import { resources } from '../resources';

export class Home extends Component {
  static displayName = Home.name;

  render () {
    return (
      <div class="tw-overflow-hidden tw-antialiased tw-font-roboto tw-mx-4">
        <div class="h-noheader md:tw-flex">
          <div class="tw-flex tw-items-center tw-justify-center tw-w-full">
            <div class="tw-px-4">
            <img class="tw-object-cover tw-w-1/2 tw-my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
              <div class="maintitles tw-uppercase">{resources.APP_NAME}</div>
              <div class="tw-w-16 tw-h-1 tw-my-3 tw-bg-secondary md:tw-my-6"></div>
              <p class="tw-text-4xl tw-font-light tw-leading-normal tw-text-accent md:tw-text-5xl loading tw-uppercase">{resources.MOON_FARMING}</p>
              <a href="/farming">
                <button class="tw-px-4 tw-py-2 tw-mt-4 tw-text-lg tw-text-accent tw-border-accent tw-duration-200 tw-transform tw-border tw-rounded-lg hover:tw-bg-purple-100 focus:tw-outline-none">{resources.START_FARMING}</button>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
