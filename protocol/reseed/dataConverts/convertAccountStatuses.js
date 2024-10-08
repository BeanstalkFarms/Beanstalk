const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");
const { BigNumber } = require("ethers");

function parseAccountStatus(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const accounts = JSON.parse(data);
    const result = [];
    smartContractTotalStalk = BigNumber.from("0");
    smartContractTotalRoots = BigNumber.from("0");

    for (const account in accounts) {
      if (accounts.hasOwnProperty(account)) {
        const accountData = accounts[account];
        const stalk = accountData.stalk ? convertToBigNum(accountData.stalk) : "0";
        const lastUpdate = accountData.lastUpdate ? convertToBigNum(accountData.lastUpdate) : "0";
        const mowStatuses = accountData.mowStatuses;
        const tokenAddresses = [];
        const mowStatusArray = [];
        // Parse germinatingStalk field
        const germinatingStalkOdd = accountData.germinatingStalk?.["0"]
          ? convertToBigNum(accountData.germinatingStalk["0"])
          : "0";
        const germinatingStalkEven = accountData.germinatingStalk?.["1"]
          ? convertToBigNum(accountData.germinatingStalk["1"])
          : "0";
        for (const tokenAddress in mowStatuses) {
          if (mowStatuses.hasOwnProperty(tokenAddress)) {
            tokenAddresses.push(tokenAddress);
            const lastStem = mowStatuses[tokenAddress].lastStem;
            const bdv = mowStatuses[tokenAddress].bdv;
            mowStatusArray.push([convertToBigNum(lastStem), convertToBigNum(bdv)]);
          }
        }

        // do not include contract accounts
        if (!contractAccounts.includes(account.toLowerCase())) {
          result.push([
            account,
            stalk,
            tokenAddresses,
            mowStatusArray,
            lastUpdate,
            germinatingStalkOdd,
            germinatingStalkEven
          ]);
        } else {
          // keep track of contract account stalk and roots
          let stalkNum = BigNumber.from(stalk);
          smartContractTotalStalk = smartContractTotalStalk.add(stalkNum);
          const accountRoots = stalkNum.mul(1e12);
          smartContractTotalRoots = smartContractTotalRoots.add(accountRoots);
        }
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Account Status JSON has been written successfully");

    // return the total stalk and roots for contract accounts to exclude them from global stalk and roots
    return [smartContractTotalStalk, smartContractTotalRoots];
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseAccountStatus = parseAccountStatus;
