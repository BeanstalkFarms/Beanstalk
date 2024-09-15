const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { deployContract } = require("../scripts/contracts");
const fs = require("fs");

async function reseedGlobal(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseedGlobal: reseedGlobal.\n");

  // Files
  let globalsPath = "./reseed/data/global.json";
  let settings = JSON.parse(await fs.readFileSync(globalsPath));

  // deploy ShipmentPlanner.sol.
  const ShipmentPlanner = await deployContract("ShipmentPlanner", account, true, [L2Beanstalk]);

  // replace the shipment parameter with the deployed shipment address.
  settings[9][0][0] = ShipmentPlanner.address;
  settings[9][1][0] = ShipmentPlanner.address;
  settings[9][2][0] = ShipmentPlanner.address;

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedGlobal",
    initArgs: [settings],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseedGlobal = reseedGlobal;
