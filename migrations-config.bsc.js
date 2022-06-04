module.exports = {
  ...require("./migrations-config.js"),
  governance: {
    minDelay: 30, // Minimum delay timer in seconds
    proposers: ['0x315965ec9f3595e58faFF127cfaDAe7e0ceC02b9'],
    executors: ['0x315965ec9f3595e58faFF127cfaDAe7e0ceC02b9']
  }
};
