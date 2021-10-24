import React, { Component } from 'react';

export class Home extends Component {
  static displayName = Home.name;

  render () {
    return (
      <div class="overflow-hidden antialiased font-roboto mx-4">
            
      <div class="h-noheader md:flex">
        <div class="flex items-center justify-center w-full">
          <div class="px-4">
          <img class="object-cover w-1/2 my-10" src="../../assets/img/svg/schnoodle-logo-white.svg" alt="Schnoodle logo" />
            <div class="maintitles">SCHNOODLE X</div>
            <div class="w-16 h-1 my-3 bg-secondary md:my-6"></div>
            <p class="text-4xl font-light leading-normal text-accent md:text-5xl loading">STAKING</p>
            <a href="/staking">
            <button class="px-4 py-2 mt-4 text-lg text-accent border-accent duration-200 transform border rounded-lg hover:bg-purple-100 focus:outline-none">
                            Start Staking
                        </button>
                        </a>
          </div>
        </div>
      </div>
    </div>
    );
  }
}
