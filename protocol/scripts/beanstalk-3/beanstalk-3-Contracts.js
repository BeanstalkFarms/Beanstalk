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

  const contractAddresses = fs
    .readFileSync("./scripts/beanstalk-3/data/inputs/ContractAddresses.txt", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // loop through and update contract addresses to be the checksummed address
  for (const [address, data] of Object.entries(contractAddresses)) {
    contractAddresses[address] = ethers.utils.getAddress(data);
  }

  console.log("Contract Addresses:", contractAddresses);

  const BLOCK_NUMBER = 20736200;
  const storageAccountsPath = `./reseed/data/exports/storage-accounts${BLOCK_NUMBER}.json`;
  const storageFertPath = `./reseed/data/exports/storage-fertilizer${BLOCK_NUMBER}.json`;
  const storagePodOrdersPath = `./reseed/data/exports/market-info20330000.json`; // update upon mainnet freeze

  // update Deposits.json
  const allDeposits = JSON.parse(fs.readFileSync(storageAccountsPath));
  const deposits = restructureDeposits(allDeposits, contractAddresses);
  fs.writeFileSync(DEPOSITS, JSON.stringify(deposits, null, 2));

  // update Plots.json
  const allPlotsData = JSON.parse(fs.readFileSync(storageAccountsPath));
  var plots = restructurePlots(allPlotsData, contractAddresses);

  // Process the plots to keep only the top 435 per address
  plots = processPlots(plots);

  fs.writeFileSync(PLOTS, JSON.stringify(plots, null, 2));

  // update InternalBalances.json
  const allInternalBalances = JSON.parse(fs.readFileSync(storageAccountsPath));
  const internalBalances = restructureInternalBalances(allInternalBalances, contractAddresses);
  fs.writeFileSync(INTERNAL_BALS, JSON.stringify(internalBalances, null, 2));

  // update Fertilizers.json
  const allFertilizers = JSON.parse(fs.readFileSync(storageFertPath));
  const fertilizers = restructureFertilizers(allFertilizers, contractAddresses);
  fs.writeFileSync(FERTILIZERS, JSON.stringify(fertilizers, null, 2));

  // update PodOrders.json
  // Oh snap there are zero contracts with pod orders open right now
  // const allPodOrders = JSON.parse(fs.readFileSync(storagePodOrdersPath));
  // console.log("PodOrders:", allPodOrders);
  // const podOrders = restructureMarketInfo(allPodOrders, contractAddresses);
  // fs.writeFileSync(POD_ORDERS, JSON.stringify(podOrders, null, 2));
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

function processPlots(plots, maxPlotsPerAddress = 435) {
  return plots.map(([address, indices, sizes]) => {
    // If there are 435 or fewer plots, return the original data
    if (sizes.length <= maxPlotsPerAddress) {
      return [address, indices, sizes];
    }

    // Create an array of objects with index and size
    let plotData = indices.map((index, i) => ({
      index: index,
      size: BigInt(sizes[i]) // Convert to BigInt for accurate sorting
    }));

    // Sort the plots by size in descending order
    plotData.sort((a, b) => (b.size > a.size ? 1 : -1));

    // sum the total of the first 435 plots, then the next 435 plots, etc.
    let groupSums = [];
    for (let i = 0; i < plotData.length; i += maxPlotsPerAddress) {
      let groupSum = plotData
        .slice(i, i + maxPlotsPerAddress)
        .reduce((sum, plot) => sum + plot.size, BigInt(0));
      groupSums.push(groupSum.toString());
    }

    console.log("Group sums for address:", address);
    console.log(groupSums);

    // Keep only the top 435 plots
    plotData = plotData.slice(0, maxPlotsPerAddress);

    // Sort back by index to maintain original order
    plotData.sort((a, b) => a.index - b.index);

    // Extract the indices and sizes
    const newIndices = plotData.map((plot) => plot.index);
    const newSizes = plotData.map((plot) => plot.size.toString()); // Convert back to string

    return [address, newIndices, newSizes];
  });
}

function restructurePlots(inputData, addressesToInclude) {
  return Object.entries(inputData)
    .filter(
      ([address, data]) =>
        addressesToInclude.includes(address) &&
        data.fields &&
        data.fields["0"] &&
        Object.keys(data.fields["0"].plots).length > 0
    )
    .map(([address, data]) => {
      const plotIndexes = [];
      const podAmounts = [];

      Object.entries(data.fields["0"].plots).forEach(([index, pods]) => {
        plotIndexes.push(BigInt(index).toString());
        podAmounts.push(BigInt(pods).toString());
      });

      return [address, plotIndexes, podAmounts];
    });
}

function restructureInternalBalances(inputData, addressesToInclude) {
  return Object.entries(inputData)
    .filter(
      ([address, data]) =>
        addressesToInclude.includes(address) &&
        data.internalTokenBalance &&
        Object.keys(data.internalTokenBalance).length > 0
    )
    .map(([address, data]) => {
      const tokenAddresses = [];
      const balances = [];

      Object.entries(data.internalTokenBalance).forEach(([tokenAddress, balance]) => {
        tokenAddresses.push(tokenAddress);
        balances.push(BigInt(balance).toString());
      });

      return [address, tokenAddresses, balances];
    });
}

function restructureFertilizers(inputData, addressesToInclude) {
  const fertilizerByAddress = {};

  // First, group the data by address
  Object.entries(inputData._balances).forEach(([fertId, addressData]) => {
    Object.entries(addressData).forEach(([address, data]) => {
      if (addressesToInclude.includes(address)) {
        if (!fertilizerByAddress[address]) {
          fertilizerByAddress[address] = [];
        }
        fertilizerByAddress[address].push({
          fertId,
          amount: data.amount,
          lastBpf: data.lastBpf
        });
      }
    });
  });

  // Then, process and format the data
  return Object.entries(fertilizerByAddress).map(([address, fertilizers]) => {
    const fertIds = [];
    const amounts = [];
    let lastBpf = "0";

    fertilizers.forEach((fert) => {
      fertIds.push(fert.fertId);
      amounts.push(BigInt(fert.amount).toString());
      // Update lastBpf if it's larger
      if (BigInt(fert.lastBpf) > BigInt(lastBpf)) {
        lastBpf = fert.lastBpf;
      }
    });

    return [address, fertIds, amounts, BigInt(lastBpf).toString()];
  });
}

function restructureMarketInfo(inputData, addressesToInclude) {
  const marketInfoByAddress = {};

  // First, group the data by address
  Object.entries(inputData.listings).forEach(([listingId, listing]) => {
    const address = listing.account.toLowerCase();
    if (addressesToInclude.includes(address)) {
      if (!marketInfoByAddress[address]) {
        marketInfoByAddress[address] = [];
      }
      marketInfoByAddress[address].push({
        orderer: address,
        fieldId: listing.fieldId,
        pricePerPod: listing.pricePerPod,
        maxPlaceInLine: listing.maxHarvestableIndex,
        minFillAmount: listing.minFillAmount,
        amount: listing.amount
      });
    }
  });

  // Then, process and format the data
  return Object.entries(marketInfoByAddress).map(([address, listings]) => {
    const formattedListings = listings.map((listing) => [
      [
        listing.orderer,
        listing.fieldId.toString(),
        listing.pricePerPod.toString(),
        listing.maxPlaceInLine,
        listing.minFillAmount
      ],
      listing.amount
    ]);

    return [address, formattedListings];
  });
}

/////////////////// Merkle Root Generators ////////////////////

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

function generateAllMerkleRoots(verbose = false) {
  updateInputJsonData(false);
  getDepositMerkleRoot(verbose);
  getPlotMerkleRoot(verbose);
  getInternalBalMerkleRoot(verbose);
  getFertMerkleRoot(verbose);
  // getPodOrderMerkleRoot(verbose); //skipped because now there are no pod orders owned by contracts
}

generateAllMerkleRoots(false);
