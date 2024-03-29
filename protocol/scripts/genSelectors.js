const ethers = require("ethers");
const path = require("path/posix");

const args = process.argv.slice(2);

async function printSelectors(contractName, artifactFolderPath = "../out") {
  const contractFilePath = path.join(artifactFolderPath,`${contractName}.sol`,`${contractName}.json`);
  const contractArtifact = require(contractFilePath);

  // Use map to prepend '0x' to each element, return selectors.
  return Object.values(contractArtifact.methodIdentifiers).map(element => '0x' + element);
}

async function processContracts(contractNames, defaultArtifactFolderPath = "../out") {
  const promises = contractNames.map(contractName => 
    printSelectors(contractName, defaultArtifactFolderPath)
  );

  // Wait for all printSelectors calls to complete
  const results  = await Promise.all(promises);
  const coded = ethers.utils.defaultAbiCoder.encode(["bytes4[][]"], [results]);
  process.stdout.write(coded)
}

// We recommend this pattern to be able to use async/await everywhere
processContracts(args)
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});