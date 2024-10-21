const {
  MAX_UINT256,
  L2_WETH,
  L2_WSTETH,
  L2_WEETH,
  L2_WBTC,
  L2_USDC,
  L2_USDT
} = require("../test/hardhat/utils/constants.js");
const { to6, toX } = require("../test/hardhat/utils/helpers.js");
const { getWellContractAt } = require("../utils/well.js");
const fs = require("fs");

const WellAddresses = [
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce", // BEAN/WETH
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F", // BEAN/WstETH
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7" // BEAN/USDC
];

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_USDC // USDC
];

async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  const INIT_WELL_BALANCES = "./reseed/data/r2/L2_well_balances.json";
  [balancesInBeanEthWell, balancesInBeanWstEthWell, balancesInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );

  const weth = await ethers.getContractAt("IERC20", L2_WETH);
  const wsteth = await ethers.getContractAt("IERC20", L2_WSTETH);
  const usdc = await ethers.getContractAt("IERC20", L2_USDC);
  const bean = await ethers.getContractAt("IERC20", "0xBEA0005B8599265D41256905A9B3073D397812E4");

  balancesInBeanEthWell[1] = await weth.balanceOf(account.address);
  console.log("weth balance", balancesInBeanEthWell[1]);
  balancesInBeanWstEthWell[1] = await wsteth.balanceOf(account.address);
  console.log("wsteth balance", balancesInBeanWstEthWell[1]);
  balancesInBeanStableWell[1] = 20623095675;
  console.log("usdc balance", balancesInBeanStableWell[1]);

  const nonBeanAmounts = [
    balancesInBeanEthWell[1], // BEAN/WETH
    balancesInBeanWstEthWell[1], // BEAN/WstETH
    balancesInBeanStableWell[1] // BEAN/USDC
  ];

  const beanAmounts = [
    balancesInBeanEthWell[0], // BEAN/WETH
    balancesInBeanWstEthWell[0], // BEAN/WstETH
    balancesInBeanStableWell[0] // BEAN/USDC
  ];

  const cp2 = await getWellContractAt(
    "constantProduct2",
    "0xbA1500c28C8965521f47F17Fc21A7829D6E1343e",
    "1.2"
  );
  const ss = await getWellContractAt(
    "Stable2",
    "0xba150052e11591D0648b17A0E608511874921CBC",
    "1.2"
  );
  console.log("-----------------------------------");
  console.log("Add liquidity to wells and transfer LP tokens to L2 beanstalk.\n");

  let minLiqAmounts = [];
  minLiqAmounts.push(await cp2.calcLpTokenSupply([beanAmounts[0], nonBeanAmounts[0]], "0x")); // weth
  minLiqAmounts.push(await cp2.calcLpTokenSupply([beanAmounts[1], nonBeanAmounts[1]], "0x")); // wsteth
  minLiqAmounts.push(
    await ss.calcLpTokenSupply(
      [beanAmounts[2], nonBeanAmounts[2]],
      "0x00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000006"
    )
  ); // usdc

  // add liquidity and transfer to L2 Beanstalk:
  for (let i = 0; i < WellAddresses.length; i++) {
    console.log(`-----------------------------------`);
    const well = await ethers.getContractAt("IWell", WellAddresses[i], account);
    const token = await ethers.getContractAt("IERC20", NonBeanToken[i], account);

    console.log(`Approving tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
    await token.connect(account).approve(well.address, MAX_UINT256);
    await bean.connect(account).approve(well.address, MAX_UINT256);
    // add liquidity to well, to L2 Beanstalk:
    console.log(
      `Adding liquidity to ${WellAddresses[i]} and performing an update to the well pump.`
    );
    console.log("minAmounts", minLiqAmounts[i]);
    await well
      .connect(account)
      .addLiquidity(
        [beanAmounts[i], nonBeanAmounts[i]],
        minLiqAmounts[i],
        L2Beanstalk,
        MAX_UINT256
      );
    console.log("Liquidity added");
    // perform a sync to update the well pump:
    await well.connect(account).sync(L2Beanstalk, 0);
    console.log("Well pump updated");
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
