const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parseInternalBalances(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const accounts = JSON.parse(data);
    const result = [];

    for (const account in accounts) {
      if (accounts.hasOwnProperty(account)) {
        const internalBalances = accounts[account].internalTokenBalance;
        for (const tokenAddress in internalBalances) {
          if (internalBalances.hasOwnProperty(tokenAddress)) {
            const balance = internalBalances[tokenAddress];
            // do not include contract accounts
            if (!contractAccounts.includes(account.toLowerCase())) {
              result.push([account, tokenAddress, convertToBigNum(balance)]);
            }
          }
        }
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Internal Balances JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseInternalBalances = parseInternalBalances;
