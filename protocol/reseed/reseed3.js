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
    verbose: false,
    account: account
  });

  // current mock addresses. This can change upon reordering the reseed/changing the salt:
  // Beanstalk Diamond: 0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70
  // Fertilizer deployed at:  0xC59f881074Bf039352C227E21980317e6b969c8A
  // Bean deployed at:  0xe64718A6d44406dE942d3d0f591E370B22263382
  // Unripe Bean deployed at:  0x9dBA4d8D19a35c5cf191C3F93a0C112e75a627E4
  // Unripe LP deployed at:  0xECA13f8A535876C8293B0E140B56fFe5768c5816
  // BEAN/WETH: 0x8cDa74f4e430e3AD0Da6Ab2721E74164DcE981fd
  // BEAN/WstETH: 0xF95f4cEe40313dBF19F6Cc53203940A17598B3a9
  // BEAN/WEETH: 0x9b0909E4Eff268570e767405CA4F89fA1f42385c
  // BEAN/WBTC: 0xf9Aaa4eE845B2dC4A02692b757e7038bB8220AAF
  // BEAN/USDC: 0x2FBa48E34376536fC1c14AacD49e4683Bd2055a1
  // BEAN/USDT: 0xEd7dDFD1a400AAdC2C4b2629026D886B40B4b87A

  console.log("-----------------------------------");
}

exports.reseed3 = reseed3;
