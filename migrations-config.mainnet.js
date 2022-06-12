module.exports = {
  ...require("./migrations-config.js"),
  governance: {
    minDelay: 86400, // Minimum delay timer in seconds
    proposers: ['0x81296C370418c4A9534599b5369A0c2913133599'],
    executors: ['0x81296C370418c4A9534599b5369A0c2913133599']
  }
};
