const { impersonateSigner } = require("../utils/index.js");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { deployMockToken, getWellContractAt } = require("../utils/well.js");
const {
  L2_WETH_ADDRESS,
  L2_WSTETH_ADDRESS,
  L2_USDC_ADDRESS,
  BEAN
} = require("../test/hardhat/utils/constants.js");
const { deployBasinV1_2Components, deployUpgradeableWell } = require("../scripts/basinV1_2.js");

// Files
const INIT_SUPPLY = "./reseed/data/r3/L2_initial_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/r3/L2_well_balances.json";
const EXTERNAL_UNRIPE = "./reseed/data/r3/L2_external_unripe_balances.json";

/**
 * reseed8 approves beanstalk to use the BCM's wsteth, eth, and a stablecoin,
 * where it will 1) transfer to a well 2) sync and add liquidity, upon deployment.
 * note: for testing purposes, the L2 is on base, and the stablecoin is USDC, but can be switched based on the discretion of the DAO.
 */
async function reseed3(account, L2Beanstalk, mock = false, deployBasin = true) {
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
    // Deploy 3 mock tokens
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
    weth = await ethers.getContractAt("IERC20", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    wsteth = await ethers.getContractAt("IERC20", "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0");
    stable = await ethers.getContractAt("IERC20", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
  }

  // deploy basin components, if deployBasin is enabled:
  wells = [];
  if (deployBasin) {
    // TODO: replace aquifer on L2
    aquifer = await getWellContractAt("Aquifer", "0xBA51AAAA95aeEFc1292515b36D86C51dC7877773");
    cp2 = await getWellContractAt(
      "ConstantProduct2",
      "0xBA150C2ae0f8450D4B832beeFa3338d4b5982d26",
      "1.2"
    );
    mfp = await getWellContractAt(
      "MultiFlowPump",
      "0xBA51AaaAa95bA1d5efB3cB1A3f50a09165315A17",
      "1.2"
    );
    mfpData =
      "0x3ffeef368eb04325c526c2246eec3e5500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000603ff9eb851eb851eb851eb851eb851eb8000000000000000000000000000000003ff9eb851eb851eb851eb851eb851eb8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003ff747ae147ae147ae147ae147ae147a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023ff747ae147ae147ae147ae147ae147a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    [uWell, stable2] = await deployBasinV1_2Components();

    // deploy the following upgradeable wells:
    // BEAN/WETH
    // BEAN/WSTETH
    // BEAN/WEETH
    // BEAN/WBTC
    // BEAN/USDC
    // BEAN/USDT
    cp2Tokens = [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
      // more tokens should be added here.
    ];
    s2Tokens = [
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
      // more tokens should be added here.
    ];
    // loop through tokens:
    for (let i = 0; i < cp2Tokens.length; i++) {
      wells.push(
        await deployUpgradeableWell(
          aquifer,
          BEAN,
          cp2Tokens[i],
          uWell,
          cp2,
          "0x",
          mfp,
          mfpData,
          "0x0000000000000000000000000000000000000000000000000000000000000001"
        )
      );
    }

    for (let i = 0; i < s2Tokens.length; i++) {
      wells.push(
        await deployUpgradeableWell(
          aquifer,
          BEAN,
          s2Tokens[i],
          uWell,
          stable2,
          ethers.utils.solidityPack(["uint256", "uint256"], [6, 18]),
          mfp,
          mfpData,
          "0x0000000000000000000000000000000000000000000000000000000000000001"
        )
      );
    }
  }

  console.log("Wells deployed:", wells);

  // approve beanstalk:
  await weth.connect(approver).approve(L2Beanstalk, ethInBeanEthWell[0]);
  await wsteth.connect(approver).approve(L2Beanstalk, wstEthInBeanWstEthWell[0]);
  await stable.connect(approver).approve(L2Beanstalk, stableInBeanStableWell[0]);

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

exports.reseed3 = reseed3;
