import Web3 from 'web3';

const getWeb3 = async () => {
  // Modern DApp browsers
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
      // Request account access if needed
      await window.ethereum.enable();
      // Accounts now exposed
      return web3;
    } catch (err) {
      throw err;
    }
  }
  // Legacy DApp browsers
  else if (window.web3) {
    console.log('Injected web3 detected.');
    // Use Mist/MetaMask's provider.
    return window.web3;
  }
  // Fallback to localhost; use dev console port by default
  else {
    console.log('No web3 instance injected, using Local web3.');
    return new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }
};

export default getWeb3;
