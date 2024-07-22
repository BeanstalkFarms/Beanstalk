const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_INTERNAL_BALANCES = "./reseed/data/r6/bean_internal.json";
const BEAN_ETH_BALANCES = "./reseed/data/r6/bean_eth_internal.json";
const BEAN_WSTETH_BALANCES = "./reseed/data/r6/bean_wsteth_internal.json";
const BEAN_STABLE_BALANCES = "./reseed/data/r6/bean_3crv_internal.json";
const URBEAN_BALANCES = "./reseed/data/r6/ur_bean_internal.json";
const URBEAN_LP_BALANCES = "./reseed/data/r6/ur_beanlp_internal.json";

async function reseed6(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue internal balances.\n");
  let beanBalances = JSON.parse(await fs.readFileSync(BEAN_INTERNAL_BALANCES));
  let beanEthBalances = JSON.parse(await fs.readFileSync(BEAN_ETH_BALANCES));
  let beanWstethBalances = JSON.parse(await fs.readFileSync(BEAN_WSTETH_BALANCES));
  let beanStableBalances = JSON.parse(await fs.readFileSync(BEAN_STABLE_BALANCES));
  let urBeanBalances = JSON.parse(await fs.readFileSync(URBEAN_BALANCES));
  let urBeanLpBalances = JSON.parse(await fs.readFileSync(URBEAN_LP_BALANCES));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedInternalBalances",
    initArgs: [
      beanBalances,
      beanEthBalances,
      beanWstethBalances,
      beanStableBalances,
      urBeanBalances,
      urBeanLpBalances
    ],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}

exports.reseed6 = reseed6;
