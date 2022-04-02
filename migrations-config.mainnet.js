module.exports = {
  initialization: {
    serviceAccount: '0x78FC40ca8A23cf02654d4A5638Ba4d71BAcaa965',
    initialTokens: 1000000000000,
    feePercent: 4,
    donationPercent: 1,
    eleemosynary: '0x0000000000000000000000000000000000000000'
  },
  governance: {
    minDelay: 86400, // Minimum delay timer in seconds
    proposers: ['0x81296C370418c4A9534599b5369A0c2913133599'],
    executors: ['0x81296C370418c4A9534599b5369A0c2913133599']
  },
  bridgeOwner: '0x3Fb6E133a40Af01Bb6dA475EB6c9F68AFe1C845A'
};
