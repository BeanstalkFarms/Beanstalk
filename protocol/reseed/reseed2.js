const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

async function reseed2(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseed2: Migrate pod listings and orders in the pod marketplace.\n");

  // Files
  let podListingsPath;
  let podOrdersPath;
  if (mock) {
    podListingsPath = "./reseed/data/mocks/r2/pod-listings-mock.json";
    podOrdersPath = "./reseed/data/mocks/r2/pod-orders-mock.json";
  } else {
    podListingsPath = "./reseed/data/r2/pod-listings.json";
    podOrdersPath = "./reseed/data/r2/pod-orders.json";
  }
  const podListings = JSON.parse(await fs.readFileSync(podListingsPath));
  const podOrders = JSON.parse(await fs.readFileSync(podOrdersPath));
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedPodMarket",
    initArgs: [podListings, podOrders],
    bip: false,
    verbose: true,
    account: account,
    checkGas: true
  });
  console.log("-----------------------------------");
}

exports.reseed2 = reseed2;
