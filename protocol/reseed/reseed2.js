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
async function reseed2(account, L2Beanstalk, deployBasin = true, fertilizerImplementation, mock) {
  verbose = true;
  console.log("-----------------------------------");
  console.log("reseed2: deploy bean tokens.\n");
  [beanSupply, unripeBeanSupply, unripeLpSupply] = JSON.parse(await fs.readFileSync(INIT_SUPPLY));
  [ethInBeanEthWell, wstEthInBeanWstEthWell, stableInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );
  [urBean, urBeanLP] = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE));

  // mint:
  let weth, wsteth, stable, owner;
  let approver = account;
  if (mock) {
    // Deploy mock tokens
    weth = await deployMockToken("WETH", "WETH");
    wsteth = await deployMockToken("wstETH", "wstETH");
    stable = await deployMockToken("USDC", "USDC");
    owner = await impersonateSigner(account.address);
    approver = owner;
    await weth.mint(account.address, ethInBeanEthWell[0]);
    await wsteth.mint(account.address, wstEthInBeanWstEthWell[0]);
    await stable.mint(account.address, stableInBeanStableWell[0]);
  } else {
    weth = await ethers.getContractAt("IERC20", L2_WETH);
    wsteth = await ethers.getContractAt("IERC20", L2_WEETH);
    stable = await ethers.getContractAt("IERC20", L2_WBTC);
  }

  if (deployBasin) {
    [uWell, stable2] = await deployBasinV1_2Components();
    console.log("uWell:", uWell.address);
    console.log("stable2:", stable2.address);
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

exports.reseed2 = reseed2;
