import Web3 from 'web3';

const getWeb3 = async () => {
  if (window.ethereum) { // Modern DApp browsers
    const web3 = new Web3(window.ethereum);
    try {
      // Request account access if needed
      await window.ethereum.enable();
      // Accounts now exposed
      return web3;
    } catch (err) {
      throw err;
    }
  } else if (window.web3) { // Legacy DApp browsers
    console.log('Injected web3 detected.');
    // Use Mist/MetaMask's provider
    return window.web3;
  } else { // Fallback to localhost; use dev console port by default
    console.log('No web3 instance injected, using Local web3.');
    return new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }
}

export default getWeb3;
