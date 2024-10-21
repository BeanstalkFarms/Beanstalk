const fs = require("fs");
const path = require("path");

function getProofForAccount(jsonFilePath, account) {
  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    // Create a new object with lowercased keys
    const lowercaseProofs = Object.keys(jsonData.proofs).reduce((acc, key) => {
      acc[key.toLowerCase()] = jsonData.proofs[key];
      return acc;
    }, {});

    // Convert the input account to lowercase
    const lowercaseAccount = account.toLowerCase();

    // Check if the lowercased account exists in the proofs object
    if (lowercaseProofs.hasOwnProperty(lowercaseAccount)) {
      const proof = lowercaseProofs[lowercaseAccount];

      // Convert the proof array to a single packed string without '0x' prefixes
      return proof.map((element) => element.slice(2)).join("");
    } else {
      return "NO_PROOF_FOUND";
    }
  } catch (error) {
    console.error(`Error reading proof data: ${error.message}`);
    return "ERROR_READING_PROOF";
  }
}

// Get the command line arguments
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const account = args[1];

// Run the function and output the result
const proof = getProofForAccount(jsonFilePath, account);
console.log(proof);
