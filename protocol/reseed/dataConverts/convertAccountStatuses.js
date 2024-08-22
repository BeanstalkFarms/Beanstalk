const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parseAccountStatus(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const accounts = JSON.parse(data);
    const result = [];

    for (const account in accounts) {
      if (accounts.hasOwnProperty(account)) {
        const accountData = accounts[account];
        const stalk = accountData.stalk ? convertToBigNum(accountData.stalk) : "0";
        const lastUpdate = accountData.lastUpdate ? convertToBigNum(accountData.lastUpdate) : "0";
        const mowStatuses = accountData.mowStatuses;
        const tokenAddresses = [];
        const mowStatusArray = [];

        for (const tokenAddress in mowStatuses) {
          if (mowStatuses.hasOwnProperty(tokenAddress)) {
            tokenAddresses.push(tokenAddress);
            const lastStem = mowStatuses[tokenAddress].lastStem;
            const bdv = mowStatuses[tokenAddress].bdv;
            mowStatusArray.push([convertToBigNum(lastStem), convertToBigNum(bdv)]);
          }
        }

        // do not include contract accounts
        if (!contractAccounts.includes(account)) {
          result.push([account, stalk, tokenAddresses, mowStatusArray, lastUpdate]);
        }
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Account Status JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseAccountStatus = parseAccountStatus;
