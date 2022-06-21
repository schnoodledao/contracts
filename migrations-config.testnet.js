module.exports = {
  ...require("./migrations-config.js"),
  governance: {
    minDelay: 30, // Minimum delay timer in seconds
    proposers: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B'],
    executors: ['0xF4157e28eF1d741F3B3f4050E2273cb206Cafc3B']
  }
};
