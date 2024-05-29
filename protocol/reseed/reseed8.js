const { impersonateSigner } = require("../utils");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

const { L2_WETH_ADDRESS, L2_WSTETH_ADDRESS, L2_USDC_ADDRESS } = require("../test/utils/constants");

// Files
const INIT_SUPPLY = "./reseed/data/r8-L2_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/r8-L2_well_balances.json";
const EXTERNAL_UNRIPE = "./reseed/data/r8-L2_external_unripe_balances.json";

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
  [beanEthAmounts, beanWstethAmounts, beanStableAmounts] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );
  [urBean, urBeanLP] = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE));

  const weth = await ethers.getContractFactory("IERC20", L2_WETH_ADDRESS);
  const wsteth = await ethers.getContractFactory("IERC20", L2_WSTETH_ADDRESS);
  const stable = await ethers.getContractFactory("IERC20", L2_USDC_ADDRESS);

  // mint:
  if (mock) {
    owner = impersonateSigner(account);
    await weth.mint(account, ethInBeanEthWell);
    await wsteth.mint(account, wstEthInBeanWstEthWell);
    await stable.mint(account, stableInBeanStableWell);

    // approve beanstalk:
    await weth.connect(owner).approve(L2Beanstalk, ethInBeanEthWell);
    await wsteth.connect(owner).approve(L2Beanstalk, wstEthInBeanWstEthWell);
    await stable.connect(owner).approve(L2Beanstalk, stableInBeanStableWell);
  }

  // call init:
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedBean",
    initArgs: [
      account,
      beanSupply,
      unripeBeanSupply,
      unripeLpSupply,
      beanEthAmounts,
      beanWstethAmounts,
      beanStableAmounts,
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
