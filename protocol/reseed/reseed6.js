const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_DEPOSITS = "./reseed/data/r5/bean_deposits.json";
const BEAN_ETH_DEPOSITS = "./reseed/data/r5/bean_eth_deposits.json";
const BEAN_WSTETH_DEPOSITS = "./reseed/data/r5/bean_wsteth_deposits.json";
const BEAN_3CRV_DEPOSITS = "./reseed/data/r5/bean_3crv_deposits.json";
const UR_BEAN_DEPOSITS = "./reseed/data/r5/ur_bean_deposits.json";
const UR_BEANLP_DEPOSITS = "./reseed/data/r5/ur_beanlp_deposits.json";

async function reseed6(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue deposits.\n");
  let beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  let beanEthDeposits = JSON.parse(await fs.readFileSync(BEAN_ETH_DEPOSITS));
  let beanWstEthDeposits = JSON.parse(await fs.readFileSync(BEAN_WSTETH_DEPOSITS));
  let bean3CrvDeposits = JSON.parse(await fs.readFileSync(BEAN_3CRV_DEPOSITS));
  let urBeanDeposits = JSON.parse(await fs.readFileSync(UR_BEAN_DEPOSITS));
  let urBeanLpDeposits = JSON.parse(await fs.readFileSync(UR_BEANLP_DEPOSITS));

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

exports.reseed6 = reseed6;
