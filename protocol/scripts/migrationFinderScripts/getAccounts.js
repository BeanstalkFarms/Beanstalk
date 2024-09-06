const fs = require("fs");
const { ethers } = require("ethers");
const { BigNumber } = require("ethers");

// Define the paths as variables
const jsonFilePath = "./reseed/data/exports/storage-accounts20577510.json"; // Replace with your actual JSON file path
const outputFilePath = "./test/foundry/Migration/data/accounts.txt"; // Replace with your desired output file path

function extractAccountAddresses(jsonFilePath, outputFilePath, numAccounts) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
    // limit array to 100 elements
    const accountAddresses = Object.keys(jsonData).slice(0, numAccounts);
    // Write the account addresses to a text file, each address on a new line
    fs.writeFileSync(outputFilePath, accountAddresses.join("\n"), "utf8");
    console.log(ethers.utils.hexlify(BigNumber.from(accountAddresses.length)));
  } catch (error) {
    console.error(`Error processing the JSON file: ${error.message}`);
  }
}

// get number of accounts from command line
const args = process.argv.slice(2);
const numAccounts = args[0];
extractAccountAddresses(jsonFilePath, outputFilePath, numAccounts);
