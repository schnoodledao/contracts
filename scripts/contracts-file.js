// scripts/contracts-file.js

module.exports = {
  append: (contractName) => {
    const fs = require('fs');
    const os = require("os");

    fs.appendFile('./contracts.txt', contractName + os.EOL, (err) => {
      if (err) {
         console.log(err);
      }
    });
  }
}
