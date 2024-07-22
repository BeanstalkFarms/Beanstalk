const { impersonateSigner } = require("../utils");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { deployMockToken } = require("../utils/well.js");

const { L2_WETH_ADDRESS, L2_WSTETH_ADDRESS, L2_USDC_ADDRESS } = require("../test/utils/constants");

// Files
const INIT_SUPPLY = "./reseed/data/r8/L2_initial_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/r8/L2_well_balances.json";
const EXTERNAL_UNRIPE = "./reseed/data/r8/L2_external_unripe_balances.json";

/**
 * reseed8 approves beanstalk to use the BCM's wsteth, eth, and a stablecoin,
 * where it will 1) transfer to a well 2) sync and add liquidity, upon deployment.
 * note: for testing purposes, the L2 is on base, and the stablecoin is USDC, but can be switched based on the discretion of the DAO.
 */
async function reseed8(account, L2Beanstalk, mock = true) {
  verbose = true;
  console.log("-----------------------------------");
  console.log("reseed8: transfer beanEth, beanWsteth, beanUSDC.\n");
  [beanSupply, unripeBeanSupply, unripeLpSupply] = JSON.parse(await fs.readFileSync(INIT_SUPPLY));
  [ethInBeanEthWell, wstEthInBeanWstEthWell, stableInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );
  [urBean, urBeanLP] = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE));

  // mint:
  if (mock) {
    // Deploy 3 mock tokens
    const weth = await deployMockToken("WETH", "WETH");
    const wsteth = await deployMockToken("wstETH", "wstETH");
    const stable = await deployMockToken("USDC", "USDC");
    const owner = await impersonateSigner(account.address);
    await weth.mint(account.address, ethInBeanEthWell[0]);
    await wsteth.mint(account.address, wstEthInBeanWstEthWell[0]);
    await stable.mint(account.address, stableInBeanStableWell[0]);

    // approve beanstalk:
    await weth.connect(owner).approve(L2Beanstalk, ethInBeanEthWell[0]);
    await wsteth.connect(owner).approve(L2Beanstalk, wstEthInBeanWstEthWell[0]);
    await stable.connect(owner).approve(L2Beanstalk, stableInBeanStableWell[0]);
  }

  // call init:
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedBean",
    initArgs: [
      beanSupply,
      unripeBeanSupply,
      unripeLpSupply,
      ethInBeanEthWell,
      wstEthInBeanWstEthWell,
      stableInBeanStableWell,
      urBean,
      urBeanLP
    ],
    bip: false,
    verbose: true,
    account: account
  });

  console.log("-----------------------------------");
}

exports.reseed8 = reseed8;


