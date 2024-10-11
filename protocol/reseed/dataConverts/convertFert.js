const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

// Helper function to split an array into chunks of a given size
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

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
          let accountArray = accountIds.map((account) => {
            const { amount, lastBpf } = accountData[account];
            return [account, convertToBigNum(amount), convertToBigNum(lastBpf)];
          });

          // Remove contract accounts from the list
          contractAccounts.forEach((contractAccount) => {
            accountArray = accountArray.filter(
              (account) => account[0].toLowerCase() !== contractAccount.toLowerCase()
            );
          });

          // Split into chunks if accountArray has more than 50 accounts
          const chunkedAccounts = chunkArray(accountArray, 50);
          chunkedAccounts.forEach((chunk) => {
            result.push([convertToBigNum(fertilizerId), chunk]); // Keep the same fertilizer ID for each chunk
          });
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

