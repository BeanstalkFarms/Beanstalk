const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_DEPOSITS = "./reseed/data/r5/bean_deposits.json";
const BEAN_ETH_DEPOSITS = "./reseed/data/r5/bean_eth_deposits.json";
const BEAN_WSTETH_DEPOSITS = "./reseed/data/r5/bean_wsteth_deposits.json";
const BEAN_3CRV_DEPOSITS = "./reseed/data/r5/bean_3crv_deposits.json";
const UR_BEAN_DEPOSITS = "./reseed/data/r5/ur_bean_deposits.json";
const UR_BEANLP_DEPOSITS = "./reseed/data/r5/ur_beanlp_deposits.json";

async function reseed5(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue deposits.\n");
  let beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  let beanEthDeposits = JSON.parse(await fs.readFileSync(BEAN_ETH_DEPOSITS));
  let beanWstEthDeposits = JSON.parse(await fs.readFileSync(BEAN_WSTETH_DEPOSITS));
  let bean3CrvDeposits = JSON.parse(await fs.readFileSync(BEAN_3CRV_DEPOSITS));
  let urBeanDeposits = JSON.parse(await fs.readFileSync(UR_BEAN_DEPOSITS));
  let urBeanLpDeposits = JSON.parse(await fs.readFileSync(UR_BEANLP_DEPOSITS));

  // Convert all plot data to correct types
  [
    beanDeposits,
    beanEthDeposits,
    beanWstEthDeposits,
    bean3CrvDeposits,
    urBeanDeposits,
    urBeanLpDeposits
  ] = [
    beanDeposits,
    beanEthDeposits,
    beanWstEthDeposits,
    bean3CrvDeposits,
    urBeanDeposits,
    urBeanLpDeposits
  ].map(convertToInt);

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

// Helper function to recursively convert string numbers to integers
function convertToInt(value) {
  // Check if the value is a valid address format
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(value);
  if (Array.isArray(value)) {
    return value.map(convertToInt);
  } else if (typeof value === 'string' && !isAddress && !isNaN(value)) {
    return parseInt(value, 10);
  }
  return value;
}

exports.reseed5 = reseed5;
