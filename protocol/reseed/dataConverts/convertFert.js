const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parseFertilizer(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const balances = JSON.parse(data)._balances;
    const result = [];

    for (const fertilizerId in balances) {
      if (balances.hasOwnProperty(fertilizerId)) {
        const accountData = balances[fertilizerId];
        const accountIds = Object.keys(accountData);

        if (accountIds.length > 0) {
          const accountArray = accountIds.map((account) => {
            const { amount, lastBpf } = accountData[account];
            return [account, convertToBigNum(amount), convertToBigNum(lastBpf)];
          });

          // remove contract accounts from the list
          for (let i = 0; i < contractAccounts.length; i++) {
            const index = accountArray.findIndex((account) => account[0] === contractAccounts[i]);
            if (index > -1) {
              accountArray.splice(index, 1);
            }
          }

          result.push([convertToBigNum(fertilizerId), accountArray]);
        }
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Fertilizer JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseFertilizer = parseFertilizer;
