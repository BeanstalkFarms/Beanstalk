const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

// problematic accounts with a lot of plots
const problematicAccounts = ["0x19A4FE7D0C76490ccA77b45580846CDB38B9A406"];

function parseField(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const accounts = JSON.parse(data);
    const result = [];

    for (const account in accounts) {
      if (accounts.hasOwnProperty(account)) {
        const fields = accounts[account].fields;
        const fieldKeys = Object.keys(fields);

        if (fieldKeys.length > 0) {
          const field = fields[fieldKeys[0]];
          const plots = field.plots;
          const plotIndexes = field.plotIndexes;

          if (Object.keys(plots).length > 0 && plotIndexes.length > 0) {
            const plotArray = plotIndexes.map((index, idx) => {
              const plotKey = Object.keys(plots)[idx];
              const amount = plots[plotKey];
              return [convertToBigNum(index), convertToBigNum(amount)];
            });

            // handle problematic accounts and contract accounts
            if (
              problematicAccounts.includes(account) &&
              !contractAccounts.includes(account.toLowerCase())
            ) {
              const chunkSize = 50;
              const chunkedArray = [];
              for (let i = 0; i < plotArray.length; i += chunkSize) {
                chunkedArray.push(plotArray.slice(i, i + chunkSize));
              }
              for (const chunk of chunkedArray) {
                result.push([account, chunk]);
              }
            } else if (!contractAccounts.includes(account.toLowerCase())) {
              result.push([account, plotArray]);
            }
          }
        }
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Field JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseField = parseField;
