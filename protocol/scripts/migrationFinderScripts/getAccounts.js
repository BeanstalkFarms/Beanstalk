const fs = require("fs");
const { ethers } = require("ethers");
const { BigNumber } = require("ethers");

// Define the paths as variables
const jsonFilePath = "./reseed/data/exports/storage-accounts20921737.json";
const outputFilePath = "./test/foundry/Migration/data/accounts.txt";

function extractAccountAddresses(jsonFilePath, outputFilePath, numAccounts, offset) {
  // Read contract addresses to exclude them from the reseed
  const contractAccountsJson = JSON.parse(
    fs.readFileSync(`./reseed/data/exports/contract-accounts20921737.json`, "utf8")
  );
  // Convert all the items in the array to lowercase for comparison
  const contractAccounts = contractAccountsJson.map((address) => address.toLowerCase());

  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
    // limit array to numAccounts elements starting from the offset
    const accountAddresses = Object.keys(jsonData).slice(offset, offset + numAccounts);
    // Filter out smart contract account addresses
    const filteredAccountAddresses = accountAddresses.filter(
      (address) => !contractAccounts.includes(address.toLowerCase())
    );
    // Write the filtered account addresses to a text file, each address on a new line
    fs.writeFileSync(outputFilePath, filteredAccountAddresses.join("\n"), "utf8");
    console.log(ethers.utils.hexlify(BigNumber.from(filteredAccountAddresses.length)));
  } catch (error) {
    console.error(`Error processing the JSON file: ${error.message}`);
  }
}

// get number of accounts and offset from command line
const args = process.argv.slice(2);
const numAccounts = parseInt(args[0], 10);
const offset = parseInt(args[1], 10);
extractAccountAddresses(jsonFilePath, outputFilePath, numAccounts, offset);
