const fs = require("fs");
const { ethers } = require("ethers");

function readFertData(jsonFilePath, account) {
  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    // Convert the input address to checksummed format
    const checksummedAccount = ethers.utils.getAddress(account);

    // Find the data for the specified account
    const accountData = jsonData.find(
      (data) => ethers.utils.getAddress(data[0]) === checksummedAccount
    );

    if (!accountData) {
      // console.error(`No fert data found for account: ${checksummedAccount}`);
      return "0x";
    }

    const fertIds = accountData[1];
    const amounts = accountData[2];
    const lastBpf = accountData[3];

    // Encode the data
    const encodedData = ethers.utils.defaultAbiCoder.encode(
      ["uint256[]", "uint128[]", "uint128"],
      [fertIds, amounts, lastBpf]
    );

    return encodedData;
  } catch (error) {
    console.error(`Error reading fert data: ${error.message}`);
    return "0x";
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const account = args[1];

// Run the function and output the result
const encodedData = readFertData(jsonFilePath, account);
console.log(encodedData);
