const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");
const { ethers } = require("ethers");
const { BigNumber } = require("ethers");

function getContractStalk(inputFilePath) {
  // Read contract addresses to exclude them from the reseed
  const contractAccountsJson = JSON.parse(
    fs.readFileSync("./reseed/data/exports/contract-accounts20895000.json", "utf8")
  );
  // Convert all the items in the array to lowercase for comparison
  const contractAccounts = contractAccountsJson.map((address) => address.toLowerCase());
  
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const accounts = JSON.parse(data);
    let smartContractTotalStalk = BigNumber.from("0");
    let smartContractTotalRoots = BigNumber.from("0");

    for (const account in accounts) {
      if (accounts.hasOwnProperty(account)) {
        const accountData = accounts[account];
        const stalk = accountData.stalk ? convertToBigNum(accountData.stalk) : "0";
        // Only track smart contract accounts
        if (contractAccounts.includes(account.toLowerCase())) {
          let stalkNum = BigNumber.from(stalk);
          smartContractTotalStalk = smartContractTotalStalk.add(stalkNum);
          const accountRoots = stalkNum.mul(1e12);
          smartContractTotalRoots = smartContractTotalRoots.add(accountRoots);
        }
      }
    }

    // Log the total stalk and roots for contract accounts to return to foundry
    console.log(ethers.utils.hexlify(ethers.BigNumber.from(smartContractTotalStalk)));
  } catch (err) {
    console.error("Error:", err);
  }
}

// Get the input file path from the command-line arguments
const inputFilePath = process.argv[2]; // Third argument is the input file path
if (!inputFilePath) {
  console.error("Please provide the input file path as a command-line argument.");
  process.exit(1); // Exit the script with an error code
}

getContractStalk(inputFilePath);
