const fs = require("fs");

function parseExternalHolders(inputFilePath, outputFilePath, contractAccounts) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const rows = data.trim().split("\n");
    const result = rows
      .map((row) => row.split(",")) // Split each row by comma to get [address, balance]
      .filter(([address]) => !contractAccounts.includes(address)) // Exclude contract accounts
      .map(([address, balance]) => [address.trim(), balance.trim()]); // Trim any excess spaces
    // Write the result to the output file as JSON
    // Remove the first entry in the array as it is the header
    result.shift();
    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("External holders JSON parsed successfully.");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseExternalHolders = parseExternalHolders;
