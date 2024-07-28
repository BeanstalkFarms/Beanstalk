//this script generates a merkle tree for the L1-RecieverFacet contract
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const fs = require("fs");
const ethers = require("ethers");

const DEPOSITS = "./scripts/beanstalk-3/data/inputs/Deposits.json";
const PLOTS = "./scripts/beanstalk-3/data/inputs/Plots.json";
const INTERNAL_BALS = "./scripts/beanstalk-3/data/inputs/InternalBalances.json";
const FERTILIZERS = "./scripts/beanstalk-3/data/inputs/Fertilizers.json";

function getDepositMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(DEPOSITS));
  data = [];
  encodedData = "";
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256[]", "uint256[]", "uint256[]", "uint256"],
      accounts[i]
    );
    // hash encoded data:
    encodedData = ethers.utils.keccak256(encodedData);
    data[i] = [accounts[i][0], encodedData];
  }
  const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

  // (3)
  console.log("Deposit Merkle Root:", tree.root);

  // (4)
  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/deposit_tree.json",
    JSON.stringify(tree.dump())
  );

  if (verbose) {
    for (const [i, v] of tree.entries()) {
      const proof = tree.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }
}

function getPlotMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(PLOTS));
  data = [];
  encodedData = "";
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256[]", "uint256[]"],
      accounts[i]
    );
    // hash encoded data:
    encodedData = ethers.utils.keccak256(encodedData);
    data[i] = [accounts[i][0], encodedData];
  }
  const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

  // (3)
  console.log("Plot Merkle Root:", tree.root);

  // (4)
  fs.writeFileSync("./scripts/beanstalk-3/data/merkle/plot_tree.json", JSON.stringify(tree.dump()));

  if (verbose) {
    for (const [i, v] of tree.entries()) {
      const proof = tree.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }
}

function getInternalBalMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(INTERNAL_BALS));
  data = [];
  encodedData = "";
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address[]", "uint256[]"],
      accounts[i]
    );
    // hash encoded data:
    encodedData = ethers.utils.keccak256(encodedData);
    data[i] = [accounts[i][0], encodedData];
  }
  const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

  // (3)
  console.log("Internal Balance Merkle Root:", tree.root);

  // (4)
  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/internal_balance_tree.json",
    JSON.stringify(tree.dump())
  );

  if (verbose) {
    for (const [i, v] of tree.entries()) {
      const proof = tree.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }
}

function getFertMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(FERTILIZERS));
  data = [];
  encodedData = "";
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256[]", "uint128[]", "uint128"],
      accounts[i]
    );
    // hash encoded data:
    encodedData = ethers.utils.keccak256(encodedData);
    data[i] = [accounts[i][0], encodedData];
  }
  const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

  // (3)
  console.log("Fertilizer Merkle Root:", tree.root);

  // (4)
  fs.writeFileSync("./scripts/beanstalk-3/data/merkle/fert_tree.json", JSON.stringify(tree.dump()));

  if (verbose) {
    for (const [i, v] of tree.entries()) {
      const proof = tree.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }
}

getDepositMerkleRoot(true);
getPlotMerkleRoot(true);
getInternalBalMerkleRoot(true);
getFertMerkleRoot(true);
