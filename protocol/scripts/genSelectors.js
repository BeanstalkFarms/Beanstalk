const ethers = require("ethers");
const path = require("path/posix");

const args = process.argv.slice(2);

if (args.length != 1) {
  console.log(`please supply the correct parameters:
    facetName
  `);
  process.exit(1);
}

async function printSelectors(contractName, artifactFolderPath = "../out") {
  const contractFilePath = path.join(
    artifactFolderPath,
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const contractArtifact = require(contractFilePath);

  // create an array of Object.values(contractArtifact.methodIdentifiers):
  const selectors = Object.values(contractArtifact.methodIdentifiers);
  // add '0x to each element of array:
  selectors.forEach((element, index) => {
    selectors[index] = '0x' + element;
  });

  const coder = ethers.utils.defaultAbiCoder;
  const coded = coder.encode(["bytes4[]"], [selectors]);

  process.stdout.write(coded);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
printSelectors(args[0], args[1])
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });