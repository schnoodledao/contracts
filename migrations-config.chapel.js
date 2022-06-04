module.exports = {
  ...require("./migrations-config.js"),
  governance: {
    minDelay: 30, // Minimum delay timer in seconds
    proposers: [],
    executors: []
  }
};
