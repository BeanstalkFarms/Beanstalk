const fs = require("fs");
const { ethers } = require("ethers");

function findFertIds(jsonFilePath, targetAccount) {
  // Load the JSON file
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

  const fertBalances = [];

  // Loop through _balances
  for (const [id, accountBalances] of Object.entries(jsonData._balances)) {
    // Check if the target account exists in this id's balances
    if (accountBalances[targetAccount]) {
      fertBalances.push({
        fertId: BigInt(id), // Add the fert ID
        amount: BigInt(accountBalances[targetAccount].amount),
        lastBpf: BigInt(accountBalances[targetAccount].lastBpf)
      });
    }
  }

  // ABI encode the array of TokenDepositId structs, now including fertId
  const encodedData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint256 fertId, uint256 amount, uint256 lastBpf)[]"],
    [fertBalances]
  );

  return encodedData;
}

// Get the command line arguments
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const account = args[1];

// Run the function and output the result
const encodedTokenDepositIds = findFertIds(jsonFilePath, account);
if (encodedTokenDepositIds) {
  console.log(encodedTokenDepositIds);
}
