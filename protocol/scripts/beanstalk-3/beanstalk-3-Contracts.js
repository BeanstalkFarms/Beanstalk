//this script generates a merkle tree for the stalk and seed discrepancies
//to be used in the mowAndMigrate function for silov3 migration

const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const fs = require("fs");
const ethers = require("ethers");

const CONTRACT_ASSETS = "./scripts/beanstalk-3/data/L2-contract-migration-data.json";

const accounts = JSON.parse(fs.readFileSync(CONTRACT_ASSETS));
// hash  the contents of the accounts.
data = [];
encodedData = "";
for (let i = 0; i < accounts.length; i++) {
  console.log(accounts[i]);
  encodedData = ethers.utils.defaultAbiCoder.encode(
    [
      "address",
      "tuple(address, uint256[], uint256[],uint256[])[]",
      "tuple(address, uint256)[]",
      "uint256"
    ],
    accounts[i]
  );
  // hash encoded data:
  encodedData = ethers.utils.keccak256(encodedData);
  console.log(encodedData);
  data[i] = [accounts[i][0], encodedData];
}
console.log(data);
const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

// (3)
console.log("Merkle Root:", tree.root);

// (4)
fs.writeFileSync("./scripts/beanstalk-3/data/tree.json", JSON.stringify(tree.dump()));

// (2)
for (const [i, v] of tree.entries()) {
  if (v[0] === "0x000000009D3a9E5c7C620514E1F36905C4eb91e5") {
    // (3)
    const proof = tree.getProof(i);
    console.log("Value:", v);
    console.log("Proof:", proof);
  }
}
