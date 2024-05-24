const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_INTERNAL_BALANCES = "./reseed/data/r6-bean_internal.json";
const BEAN_ETH_BALANCES = "./reseed/data/r6-bean_eth_internal.json";
const BEAN_WSTETH_BALANCES = "./reseed/data/r6-bean_wsteth_internal.json";
const BEAN_STABLE_BALANCES = "./reseed/data/r6-bean_stable_internal.json";

async function reseed6(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue internal balances.\n");
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_INTERNAL_BALANCES));
  const beanEthDeposits = JSON.parse(await fs.readFileSync(BEAN_ETH_BALANCES));
  const beanWstEthDeposits = JSON.parse(await fs.readFileSync(BEAN_WSTETH_BALANCES));
  const beanStableBalances = JSON.parse(await fs.readFileSync(BEAN_STABLE_BALANCES));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedInternalBalances",
    initArgs: [beanDeposits, beanEthDeposits, beanWstEthDeposits, beanStableBalances],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed6 = reseed6;
