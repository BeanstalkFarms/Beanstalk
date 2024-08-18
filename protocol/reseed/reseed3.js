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
    // TODO: Replace with actual token addresses on the L2
    weth = await ethers.getContractAt("IERC20", L2_WETH);
    wsteth = await ethers.getContractAt("IERC20", L2_WEETH);
    stable = await ethers.getContractAt("IERC20", L2_WBTC);
  }

  if (deployBasin) {
    [uWell, stable2] = await deployBasinV1_2Components();
    console.log("uWell:", uWell.address);
    console.log("stable2:", stable2.address);
  }

  // TODO: Replace with actual fert address on the L2
  // const fertilizerImplementation = "0x7B50EbC3E5128F315dc097F7cbd1600399e3E796";

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
    verbose: true,
    account: account
  });

  // current mock addresses. This can change upon reordering the reseed/changing the salt:
  // Fertilizer deployed at:  0x7B50EbC3E5128F315dc097F7cbd1600399e3E796
  // Bean deployed at:  0xe64718A6d44406dE942d3d0f591E370B22263382
  // Unripe Bean deployed at:  0x9dBA4d8D19a35c5cf191C3F93a0C112e75a627E4
  // Unripe LP deployed at:  0xECA13f8A535876C8293B0E140B56fFe5768c5816
  // bean weth well proxy: 0x441657D23F030E9F8Ce68b518AC6952Abc4e8c5E
  // bean wsteth well proxy: 0x96B57c91eDe37fc09CD8016526F99015271a7c02
  // bean weeth well proxy: 0x4A26f88C9a9508f10253649da94Eb4633bC130Aa
  // bean wbtc well proxy: 0xc0F171447Ecb93C7D38Fe0bB8Bc5020339f637d1
  // bean usdc well proxy: 0xA6D38498fb88bB79DA89de007aF86E051f7DA8ea
  // bean usdt well proxy: 0x10a1B1d06dD1b3A671D285c91DDA4A5e6a001ea1

  console.log("-----------------------------------");
}

exports.reseed3 = reseed3;
