const { impersonateSigner } = require("../utils/index.js");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { deployMockToken, getWellContractAt } = require("../utils/well.js");
const {
  L2_WETH,
  L2_WSTETH,
  L2_WEETH,
  L2_WBTC,
  L2_USDC,
  L2_USDT,
  BEAN
} = require("../test/hardhat/utils/constants.js");
const { deployBasinV1_2Components, deployUpgradeableWell } = require("../scripts/basinV1_2.js");

// Files
const INIT_SUPPLY = "./reseed/data/mocks/r3/L2_initial_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/mocks/r3/L2_well_balances.json";
const EXTERNAL_UNRIPE = "./reseed/data/mocks/r3/L2_external_unripe_balances.json";

/**
 * reseed8 approves beanstalk to use the BCM's wsteth, eth, and a stablecoin,
 * where it will 1) transfer to a well 2) sync and add liquidity, upon deployment.
 * note: for testing purposes, the L2 is on base, and the stablecoin is USDC, but can be switched based on the discretion of the DAO.
 */
async function reseed3(account, L2Beanstalk, deployBasin = true, fertilizerImplementation, mock) {
  verbose = true;
  console.log("-----------------------------------");
  console.log("reseed3: deploy bean tokens.\n");
  [beanSupply, unripeBeanSupply, unripeLpSupply] = JSON.parse(await fs.readFileSync(INIT_SUPPLY));
  [balancesBeanEthWell, balancesInBeanWstEthWell, balancesInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );
  [urBean, urBeanLP] = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE));

  if (deployBasin) {
    [uWell, stable2] = await deployBasinV1_2Components();
    console.log("uWell:", uWell.address);
    console.log("stable2:", stable2.address);
  }

  // get the bean sided liquidity from the L1 wells to mint it to the bcm.
  const beansInBeanEthWell = balancesBeanEthWell[0];
  const beansInBeanWstEthWell = balancesInBeanWstEthWell[0];
  const beansInBeanStableWell = balancesInBeanStableWell[0];

  // call init:
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedBean",
    initArgs: [
      beanSupply,
      unripeBeanSupply,
      unripeLpSupply,
      beansInBeanEthWell,
      beansInBeanWstEthWell,
      beansInBeanStableWell,
      urBean,
      urBeanLP,
      fertilizerImplementation
    ],
    bip: false,
    verbose: false,
    account: account
  });

  console.log("-----------------------------------");
}

exports.reseed3 = reseed3;
