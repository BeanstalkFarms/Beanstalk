const fs = require("fs");
const { ethers } = require("ethers");
const { BigNumber } = require("ethers");

// Define the paths as variables
const jsonFilePath = "./reseed/data/exports/storage-fertilizer20895000.json";
const outputFilePath = "./test/foundry/Migration/data/fert_accounts.txt";

function extractFertAccountAddresses(jsonFilePath, outputFilePath, numAccounts = null, offset = 0) {
  // Read contract addresses to exclude them from the reseed
  const contractAccountsJson = JSON.parse(
    fs.readFileSync("./reseed/data/exports/contract-accounts20895000.json", "utf8")
  );
  // Convert all the items in the array to lowercase for comparison
  const contractAccounts = contractAccountsJson.map((address) => address.toLowerCase());

  try {
    // Read the input JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    // Extract account addresses from the `_balances` section of the JSON
    const accountAddresses = [];
    for (const blockNumber in jsonData._balances) {
      const blockAccounts = jsonData._balances[blockNumber];
      for (const address in blockAccounts) {
        accountAddresses.push(address);
      }
    }

    // Apply offset and limit based on numAccounts and offset
    const limitedAccountAddresses = accountAddresses.slice(
      offset,
      numAccounts ? offset + numAccounts : undefined
    );

    // Filter out contract addresses (if any)
    const filteredAccountAddresses = limitedAccountAddresses.filter(
      (address) => !contractAccounts.includes(address.toLowerCase())
    );

    // Write the addresses to the output text file, each on a new line
    fs.writeFileSync(outputFilePath, filteredAccountAddresses.join("\n"), "utf8");

    // Log the number of addresses written in hexadecimal format
    console.log(ethers.utils.hexlify(BigNumber.from(filteredAccountAddresses.length)));
  } catch (error) {
    console.error(`Error processing the JSON file: ${error.message}`);
  }
}

// Get number of accounts and offset from command line
const args = process.argv.slice(2);
const numAccounts = args[0] ? parseInt(args[0], 10) : null; // If not provided, extract all
const offset = args[1] ? parseInt(args[1], 10) : 0; // Default offset is 0

// Run the extraction
extractFertAccountAddresses(jsonFilePath, outputFilePath, numAccounts, offset);
