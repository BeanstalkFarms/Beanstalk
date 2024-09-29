const {
  MAX_UINT256,
  L2_WETH,
  L2_WSTETH,
  L2_WEETH,
  L2_WBTC,
  L2_USDC,
  L2_USDT
} = require("../test/hardhat/utils/constants.js");
const { to18, to6, toX } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");
const { getWellContractAt } = require("../utils/well.js");
const fs = require("fs");
const { toBN } = require("../utils");

const WellAddresses = [
  "0xBEA00AA912aEc233303C9455f0fc2D438ac929f5", // BEAN/WETH
  "0xbea00BB0102b5F3C351a08c47C730fD0E9fD9870", // BEAN/WstETH
  "0xBEA00Cc5152e597eAfBA470453932BdC5fC3C8A1", // BEAN/WEETH
  "0xBeA00DD4B4D7cA2b4B49dE3D2A51189D22c1f31e", // BEAN/WBTC
  "0xbEA00EeEC3A0DC145c4dC5008f44212771a4704", // BEAN/USDC
  "0xBea00fF64E706B16bB5485B0aDe41d09DC95A9A9" // BEAN/USDT
];

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_WEETH, // WEETH
  L2_WBTC, // WBTC
  L2_USDC, // USDC
  L2_USDT // USDT
];

async function setBalance(
  contract, // token contract address
  account, // account address
  amount, // amount to set
  slot // storage slot to set
) {
  const index = ethers.utils.solidityKeccak256(["uint256", "uint256"], [account, slot]);
  const balance = ethers.utils.hexlify(
    ethers.utils.zeroPad(ethers.BigNumber.from(amount).toHexString(), 32)
  );
  await hre.network.provider.send("hardhat_setStorageAt", [contract, index, balance]);
}

async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  const INIT_WELL_BALANCES = "./reseed/data/r2/L2_well_balances.json";
  [balancesInBeanEthWell, balancesInBeanWstEthWell, balancesInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );

  // divide balancesInBeanStableWell[1] by 1e12:
  balancesInBeanStableWell[1] = Math.floor(balancesInBeanStableWell[1] / 1e12).toString();
  const slots = [
    51, // WETH
    1, // wstETH
    51, // WEETH
    51, // WBTC
    9, // USDC
    51 // USDT
  ];

  const L1_beanstalkBalances = [
    "1323213132988957601130", // ethLP
    "185335736965741266416875", // wstethLP
    "93024994011998500979055" // 3crvLP
  ];

  // note: the amounts
  // were updated with the amounts in `L2_well_balances.json`

  // calculate the LP token supply for each well:
  // note: this is an estimation and is used for the sake of testing.

  const cp2 = await getWellContractAt(
    "ConstantProduct2",
    "0xBA5104f2df98974A83CD10d16E24282ce6Bb647f"
  );

  const beanEthLpTokenSupply = await cp2.calcLpTokenSupply(balancesInBeanEthWell, "0x");
  console.log("beanEthLpTokenSupply", beanEthLpTokenSupply);
  const beanWstEthLpTokenSupply = await cp2.calcLpTokenSupply(balancesInBeanWstEthWell, "0x");
  console.log("beanWstEthLpTokenSupply", beanWstEthLpTokenSupply);
  // const beanStableLpTokenSupply = await cp2.calcLpTokenSupply(balancesInBeanStableWell, "0x");
  // console.log("beanStableLpTokenSupply", beanStableLpTokenSupply);

  // get the % of the total LP token supply that each well has:
  // note: the bean3crv was manually calculated given the migration to the well.
  // small buffer to avoid rounding errors.
  const beanEthLpTokenSupplyPercentage =
    L1_beanstalkBalances[0] / (beanEthLpTokenSupply * (1 - 0.000001));
  const beanWstEthLpTokenSupplyPercentage =
    L1_beanstalkBalances[1] / (beanWstEthLpTokenSupply * (1 - 0.000001));
  const beanStableLpTokenSupplyPercentage = 0.998832;

  const scaleFactor = to18("1"); // Scale factor to avoid decimals

  // Convert percentages to BigNumber with scaling
  const beanEthLpTokenSupplyPercentageBN = toBN((beanEthLpTokenSupplyPercentage * 1e18).toString());
  const beanWstEthLpTokenSupplyPercentageBN = toBN(
    (beanWstEthLpTokenSupplyPercentage * 1e18).toString()
  );
  const beanStableLpTokenSupplyPercentageBN = toBN(
    (beanStableLpTokenSupplyPercentage * 1e18).toString()
  );

  // Scale balances using the percentages
  balancesInBeanEthWell = await balancesInBeanEthWell.map((balance) => {
    const balanceBN = toBN(balance.toString());
    return balanceBN.mul(beanEthLpTokenSupplyPercentageBN).div(scaleFactor).toString(); // Scale down
  });

  balancesInBeanWstEthWell = await balancesInBeanWstEthWell.map((balance) => {
    const balanceBN = toBN(balance.toString());
    return balanceBN.mul(beanWstEthLpTokenSupplyPercentageBN).div(scaleFactor).toString(); // Scale down
  });

  balancesInBeanStableWell = await balancesInBeanStableWell.map((balance) => {
    const balanceBN = toBN(balance.toString());
    return balanceBN.mul(beanStableLpTokenSupplyPercentageBN).div(scaleFactor).toString(); // Scale down
  });

  const nonBeanAmounts = [
    balancesInBeanEthWell[1], // BEAN/WETH
    balancesInBeanWstEthWell[1], // BEAN/WstETH
    to6("0"), // BEAN/WEEETH
    toX("0", 8), // BEAN/WBTC (8 decimals)
    balancesInBeanStableWell[1], // BEAN/USDC
    to6("0") // to6("190000") // BEAN/USDT
  ];

  const beanAmounts = [
    balancesInBeanEthWell[0], // BEAN/WETH
    balancesInBeanWstEthWell[0], // BEAN/WstETH
    to6("0"), // to6("100000"), // BEAN/WEEETH
    to6("0"), // to6("1000000"), // BEAN/WBTC
    balancesInBeanStableWell[0], // BEAN/USDC
    to6("0") // to6("1000000") // BEAN/USDT
  ];
  console.log("-----------------------------------");
  console.log("Add liquidity to wells and transfer LP tokens to L2 beanstalk.\n");
  const beanAddress = "0xBEA0005B8599265D41256905A9B3073D397812E4";
  await impersonateToken(beanAddress, 6);
  const bean = await ethers.getContractAt("MockToken", beanAddress);

  // add liquidity and transfer to L2 Beanstalk:
  for (let i = 0; i < WellAddresses.length; i++) {
    console.log(`-----------------------------------`);
    const well = await ethers.getContractAt("IWell", WellAddresses[i], account);
    const token = await ethers.getContractAt("IERC20", NonBeanToken[i], account);

    if (mock) {
      console.log(`Minting tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
      await setBalance(NonBeanToken[i], account.address, nonBeanAmounts[i], slots[i]);
      await setBalance(beanAddress, account.address, beanAmounts[i], 0); // storage slot 0 for MockToken
    }

    console.log(`Approving tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
    await token.connect(account).approve(well.address, MAX_UINT256);
    await bean.connect(account).approve(well.address, MAX_UINT256);
    // add liquidity to well, to L2 Beanstalk:
    console.log(
      `Adding liquidity to ${WellAddresses[i]} and performing an update to the well pump.`
    );
    await well
      .connect(account)
      .addLiquidity([beanAmounts[i], nonBeanAmounts[i]], 0, L2Beanstalk, MAX_UINT256);
    // perform a 0 liq addition to update the well pumps and avoid "NotInitialized" error.
    await well.connect(account).addLiquidity([0, 0], 0, L2Beanstalk, MAX_UINT256);
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
