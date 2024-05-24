const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const FARMER_DEPOSITS = "./reseed/data/r5-deposits.json";

async function reseed5(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue deposits.\n");
  const [
    beanDeposits,
    beanEthDeposits,
    beanWstEthDeposits,
    bean3CrvDeposits,
    urBeanDeposits,
    urBeanLpDeposits
  ] = JSON.parse(await fs.readFileSync(FARMER_DEPOSITS));
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedSilo",
    initArgs: [
      beanDeposits,
      beanEthDeposits,
      beanWstEthDeposits,
      bean3CrvDeposits,
      urBeanDeposits,
      urBeanLpDeposits
    ],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed5 = reseed5;
