module.exports = {
  initialization: {
    owner: '0x78FC40ca8A23cf02654d4A5638Ba4d71BAcaa965',
    initialTokens: 1000000000000,
    feePercent: 5,
  },
  liquidityTimelock: {
    tokenAddress: '0x1504645dc73b702140bb7c580320d5c3ffe1678d',
    beneficiary: '0x78FC40ca8A23cf02654d4A5638Ba4d71BAcaa965',
    releaseTime: 6,
    releaseTimeUnit: 'M'
  },
  stakingTimelock: {
    beneficiary: '0x9681d2f075f35811db229f89fcd41ef88b211758',
    releaseTime: 1,
    releaseTimeUnit: 'M'
  },
  communityTimelock: {
    beneficiary: '0x45cbeee8fcb81d283928a9f9ff893ad515396348',
    releaseTime: 1,
    releaseTimeUnit: 'M'
  },
  governance: {
    minDelay: 86400, // Minimum delay timer in seconds
    proposers: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B'],
    executors: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B']
  }
};

// See https://momentjscom.readthedocs.io/en/latest/moment/03-manipulating/01-add/ for valid releaseTimeUnit values.