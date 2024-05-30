const ethers = require("ethers");
const path = require("path/posix");
const fs = require('fs');

async function printSelectors(contractName, artifactFolderPath = "../out") {
  const contractFilePath = path.join(artifactFolderPath,`${contractName}.sol`,`${contractName}.json`);
  const contractArtifact = require(contractFilePath);

  // Use map to prepend '0x' to each element, return selectors.
  return [contractName, contractArtifact.methodIdentifiers, Object.values(contractArtifact.methodIdentifiers).map(element => '0x' + element)];
}

async function processValues(contractName, artifactFolderPath = "../out") {
  data = await printSelectors(contractName, artifactFolderPath)
  return data[2]
}

async function processContracts(contractNames, defaultArtifactFolderPath = "../out") {
  const promises = contractNames.map(contractName => 
    processValues(contractName, defaultArtifactFolderPath)
  );

  // Wait for all printSelectors calls to complete
  const results  = await Promise.all(promises);
  const coded = ethers.utils.defaultAbiCoder.encode(["bytes4[][]"], [results]);
  process.stdout.write(coded)
}

async function printAllSelectors(contractNames, defaultArtifactFolderPath = "../out", verbose = true) {
  const promises = contractNames.map(contractName => 
    printSelectors(contractName, defaultArtifactFolderPath)
  );

  // Wait for all printSelectors calls to complete
  const results  = await Promise.all(promises);
  // log results to .txt file:
  if (verbose) console.log(results)

  // Write the output to a text file
  fs.writeFileSync('./reseed/data/beanstalkSelectors.json', JSON.stringify(results, null, 2));
}

exports.printSelectors = printSelectors;
exports.processContracts = processContracts;
exports.printAllSelectors = printAllSelectors;