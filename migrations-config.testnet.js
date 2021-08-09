module.exports = {
  initialization: {
    serviceAccount: '0x78FC40ca8A23cf02654d4A5638Ba4d71BAcaa965',
    initialTokens: 1000000000000,
    feePercent: 4,
    donationPercent: 1,
    eleemosynary: '0x0000000000000000000000000000000000000000'
  },
  governance: {
    minDelay: 30, // Minimum delay timer in seconds
    proposers: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B'],
    executors: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B']
  }
};
