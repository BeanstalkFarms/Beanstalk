//this script generates a merkle tree for the L1-RecieverFacet contract
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const fs = require("fs");
const ethers = require("ethers");

const DEPOSITS = "./scripts/beanstalk-3/data/inputs/Deposits.json";
const PLOTS = "./scripts/beanstalk-3/data/inputs/Plots.json";
const INTERNAL_BALS = "./scripts/beanstalk-3/data/inputs/InternalBalances.json";
const FERTILIZERS = "./scripts/beanstalk-3/data/inputs/Fertilizers.json";
const POD_ORDERS = "./scripts/beanstalk-3/data/inputs/PodOrders.json";

function updateInputJsonData(verbose = false) {
  // reads ContractAddresses.json, pulls data from protocol/reseed/data/*.json, updates corresponding deposits/plots/internalbals/fertilizers/podorders jsons

  const contractAddresses = JSON.parse(
    fs.readFileSync("./scripts/beanstalk-3/data/inputs/ContractAddresses.json")
  );

  // loop through and update contract addresses to be the checksummed address
  for (const [address, data] of Object.entries(contractAddresses)) {
    contractAddresses[address] = ethers.utils.getAddress(data);
  }

  console.log("Contract Addresses:", contractAddresses);

  const BLOCK_NUMBER = 20736200;
  const storageAccountsPath = `./reseed/data/exports/storage-accounts${BLOCK_NUMBER}.json`;

  // update Deposits.json
  const allDeposits = JSON.parse(fs.readFileSync(storageAccountsPath));
  const deposits = restructureDeposits(allDeposits, contractAddresses);
  fs.writeFileSync(DEPOSITS, JSON.stringify(deposits, null, 2));
}

function restructureDeposits(inputData, addressesToInclude) {
  return Object.entries(inputData)
    .filter(
      ([address, data]) =>
        addressesToInclude.includes(address) && Object.keys(data.deposits).length > 0
    )
    .map(([address, data]) => {
      const depositIds = Object.values(data.depositIdList).flat();
      const amounts = [];
      const bdvs = [];

      // Convert deposit IDs from uint256 to hex and collect amounts and bdvs
      Object.entries(data.deposits).forEach(([depositIdUint, deposit]) => {
        const depositIdHex = "0x" + BigInt(depositIdUint).toString(16).padStart(64, "0");
        if (!depositIds.includes(depositIdHex)) {
          depositIds.push(depositIdHex);
        }
        amounts.push(BigInt(deposit.amount).toString());
        bdvs.push(BigInt(deposit.bdv).toString());
      });

      return [address, depositIds, amounts, bdvs];
    });
}

function getDepositMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(DEPOSITS));
  data = [];
  encodedData = "";
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256[]", "uint256[]", "uint256[]"],
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
  const treeData = tree.dump();
  const treeWithProofs = {
    tree: treeData,
    proofs: {}
  };

  for (const [i, v] of tree.entries()) {
    const proof = tree.getProof(i);
    treeWithProofs.proofs[v[0]] = proof; // Use the address as the key

    if (verbose) {
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/deposit_tree.json",
    JSON.stringify(treeWithProofs, null, 2)
  );
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
  const treeData = tree.dump();
  const treeWithProofs = {
    tree: treeData,
    proofs: {}
  };

  for (const [i, v] of tree.entries()) {
    const proof = tree.getProof(i);
    treeWithProofs.proofs[v[0]] = proof; // Use the address as the key

    if (verbose) {
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/plot_tree.json",
    JSON.stringify(treeWithProofs, null, 2)
  );
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
  const treeData = tree.dump();
  const treeWithProofs = {
    tree: treeData,
    proofs: {}
  };

  for (const [i, v] of tree.entries()) {
    const proof = tree.getProof(i);
    treeWithProofs.proofs[v[0]] = proof; // Use the address as the key

    if (verbose) {
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/internal_balance_tree.json",
    JSON.stringify(treeWithProofs, null, 2)
  );
}

function getFertMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(FERTILIZERS));
  let data = [];
  let encodedData = "";
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
  const treeData = tree.dump();
  const treeWithProofs = {
    tree: treeData,
    proofs: {}
  };

  for (const [i, v] of tree.entries()) {
    const proof = tree.getProof(i);
    treeWithProofs.proofs[v[0]] = proof; // Use the address as the key

    if (verbose) {
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/fert_tree.json",
    JSON.stringify(treeWithProofs, null, 2)
  );
}

function getPodOrderMerkleRoot(verbose = false) {
  const accounts = JSON.parse(fs.readFileSync(POD_ORDERS));
  let data = [];
  let encodedData = "";
  let orderStruct = ["address", "tuple(tuple(address,uint256,uint24,uint256,uint256),uint256)[]"];
  for (let i = 0; i < accounts.length; i++) {
    encodedData = ethers.utils.defaultAbiCoder.encode(orderStruct, accounts[i]);
    // hash encoded data:
    encodedData = ethers.utils.keccak256(encodedData);
    data[i] = [accounts[i][0], encodedData];
  }
  const tree = StandardMerkleTree.of(data, ["address", "bytes32"]);

  // (3)
  console.log("PodOrder Merkle Root:", tree.root);

  // (4)
  const treeData = tree.dump();
  const treeWithProofs = {
    tree: treeData,
    proofs: {}
  };

  for (const [i, v] of tree.entries()) {
    const proof = tree.getProof(i);
    treeWithProofs.proofs[v[0]] = proof; // Use the address as the key

    if (verbose) {
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  fs.writeFileSync(
    "./scripts/beanstalk-3/data/merkle/podOrder_tree.json",
    JSON.stringify(treeWithProofs, null, 2)
  );
}

// getDepositMerkleRoot(false);
// getPlotMerkleRoot(false);
// getInternalBalMerkleRoot(false);
// getFertMerkleRoot(false);
// getPodOrderMerkleRoot(false);
updateInputJsonData(false);
