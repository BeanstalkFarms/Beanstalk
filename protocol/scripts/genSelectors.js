const ethers = require("ethers");
const path = require("path/posix");
const fs = require("fs");

const args = process.argv.slice(2);

function log(message) {
  // turn logging on or off by commenting out this following line
  // fs.appendFileSync('genSelectors.log', message + '\n');
}

async function printSelectors(contractName, artifactFolderPath = "out") {
  try {
    const contractFilePath = path.join(
      process.cwd(),
      artifactFolderPath,
      `${contractName}.sol`,
      `${contractName}.json`
    );
    log(`Looking for contract at: ${contractFilePath}`);

    if (!fs.existsSync(contractFilePath)) {
      log(`Contract file not found: ${contractFilePath}`);
      return [];
    }

    const contractArtifact = JSON.parse(fs.readFileSync(contractFilePath, "utf8"));
    log(`Contract artifact loaded for ${contractName}`);

    if (!contractArtifact.methodIdentifiers) {
      log(`No method identifiers found for ${contractName}`);
      return [];
    }

    const selectors = Object.values(contractArtifact.methodIdentifiers);
    log(`Found ${selectors.length} selectors for ${contractName}`);

    return selectors;
  } catch (error) {
    log(`Error in printSelectors for ${contractName}: ${error.message}`);
    return [];
  }
}

async function processContracts(contractNames, defaultArtifactFolderPath = "./out/") {
  try {
    log(`Current working directory: ${process.cwd()}`);

    log(`Processing contracts: ${contractNames.join(", ")}`);

    const promises = contractNames.map((contractName) =>
      printSelectors(contractName, defaultArtifactFolderPath)
    );

    const results = await Promise.all(promises);
    log(`All selectors retrieved. Number of contracts processed: ${results.length}`);

    // Compact encoding
    let encoded = ethers.utils.hexZeroPad(ethers.BigNumber.from(results.length).toHexString(), 32);
    log(`Encoded number of contracts: ${encoded}`);

    for (const selectors of results) {
      encoded += ethers.utils
        .hexZeroPad(ethers.BigNumber.from(selectors.length).toHexString(), 2)
        .slice(2);
      log(`Encoded number of selectors for a contract: ${encoded.slice(-4)}`);
      for (const selector of selectors) {
        encoded += selector;
        log(`Encoded selector: ${selector}`);
      }
    }

    log(`Final encoded data: ${encoded}`);
    return encoded;
  } catch (error) {
    log(`Error in processContracts: ${error.message}`);
    return "0x";
  }
}

processContracts(args)
  .then((encoded) => {
    log(`Writing to stdout: ${encoded}`);
    process.stdout.write(encoded);
    process.exit(0);
  })
  .catch((error) => {
    log(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
