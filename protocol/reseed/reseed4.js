const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

async function reseed4(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed4: Migrate pod listings and orders in the pod marketplace.\n");

  // Files
  let podListingsPath;
  let podOrdersPath;
  if (mock) {
    podListingsPath = "./reseed/data/mocks/r4/pod-listings-mock.json";
    podOrdersPath = "./reseed/data/mocks/r4/pod-orders-mock.json";
  } else {
    podListingsPath = "./reseed/data/r4/pod-listings.json";
    podOrdersPath = "./reseed/data/r4/pod-orders.json";
  }
  const podListings = JSON.parse(await fs.readFileSync(podListingsPath));
  const podOrders = JSON.parse(await fs.readFileSync(podOrdersPath));
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedPodMarket",
    initArgs: [podListings, podOrders],
    bip: false,
    verbose: verbose,
    account: account,
    checkGas: true
  });
  console.log("-----------------------------------");
}

exports.reseed4 = reseed4;
