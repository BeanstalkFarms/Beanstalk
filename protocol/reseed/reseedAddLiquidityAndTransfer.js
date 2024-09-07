const {
  MAX_UINT256,
  L2_WETH,
  L2_WSTETH,
  L2_WEETH,
  L2_WBTC,
  L2_USDC,
  L2_USDT
} = require("../test/hardhat/utils/constants.js");
const { to18, to6 } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");

const WellAddresses = [
  "0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB", // BEAN/WETH
  "0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8", // BEAN/WstETH
  "0xBEA00865405A02215B44eaADB853d0d2192Fc29D", // BEAN/WEETH
  "0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA", // BEAN/WBTC
  "0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279", // BEAN/USDC
  "0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b" // BEAN/USDT
];

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_WEETH, // WEETH
  L2_WBTC, // WBTC
  L2_USDC, // USDC
  L2_USDT // USDT
];

// TODO: replace with values.
const nonBeanAmounts = [
  to18("1000"), // BEAN/WETH
  to18("1000"), // BEAN/WstETH
  to18("1000"), // BEAN/WEEETH
  to18("10"), // BEAN/WBTC
  to6("100000"), // BEAN/USDC
  to6("100000") // BEAN/USDT
];

const beanAmounts = [
  to6("1000000"), // BEAN/WETH
  to6("1000000"), // BEAN/WstETH
  to6("1000000"), // BEAN/WEEETH
  to6("1000000"), // BEAN/WBTC
  to6("1000000"), // BEAN/USDC
  to6("1000000") // BEAN/USDT
];

async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  console.log("-----------------------------------");
  console.log("add liquidity to wells and transfers to l2 beanstalk.\n");

  await impersonateToken("0xBEA0005B8599265D41256905A9B3073D397812E4", 6);
  const bean = await ethers.getContractAt(
    "MockToken",
    "0xBEA0005B8599265D41256905A9B3073D397812E4"
  );
  // add liquidity and transfer to L2 Beanstalk:
  for (let i = 0; i < WellAddresses.length; i++) {
    const well = await ethers.getContractAt("IWell", WellAddresses[i], account);
    const wellERC20 = await ethers.getContractAt("IERC20", WellAddresses[i], account);
    const token = await ethers.getContractAt("MockToken", NonBeanToken[i], account);
    const decimals = await token.decimals();
    await impersonateToken(NonBeanToken[i], decimals);
    if (mock) {
      // mint tokens to add liquidity:
      console.log(`Minting tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
      await token.mint(account.address, nonBeanAmounts[i]);
      await bean.mint(account.address, beanAmounts[i] + to6("1000000"));
    }
    console.log(`Approving tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
    await token.connect(account).approve(well.address, MAX_UINT256);
    await bean.connect(account).approve(well.address, MAX_UINT256);
    // add liquidity to well, to L2 Beanstalk:
    console.log(`Adding liquidity to ${WellAddresses[i]} and performing a swap to update the well pump.`);
    await well
      .connect(account)
      .addLiquidity([beanAmounts[i], nonBeanAmounts[i]], 0, L2Beanstalk, MAX_UINT256);
    // perform a swap to update the well pumps and avoid "NotInitialized" error.
    await well.connect(account).swapFrom(bean.address, token.address, to6("1"), 0, account.address, MAX_UINT256);
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
