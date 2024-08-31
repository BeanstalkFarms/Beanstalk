const { MAX_UINT256, L2_WETH, L2_WSTETH, L2_WEETH, L2_WBTC, L2_USDC, L2_USDT } = require("../test/hardhat/utils/constants.js");
const { to18, to6 } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");

const WellAddresses = [
  "0xBEA00ebA46820994d24E45dffc5c006bBE35FD89", // BEAN/WETH
  "0xBEA0039bC614D95B65AB843C4482a1A5D2214396", // BEAN/WstETH
  "0xBEA000B7fde483F4660041158D3CA53442aD393c", // BEAN/WEETH
  "0xBEA0078b587E8f5a829E171be4A74B6bA1565e6A", // BEAN/WBTC
  "0xBEA00C30023E873D881da4363C00F600f5e14c12", // BEAN/USDC
  "0xBEA00699562C71C2d3fFc589a848353151a71A61" // BEAN/USDT
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

  // todo: update bean address once finalized.
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
      await token.mint(account.address, nonBeanAmounts[i]);
      await bean.mint(account.address, beanAmounts[i]);
    }
    await token.connect(account).approve(well.address, MAX_UINT256);
    await bean.connect(account).approve(well.address, MAX_UINT256);
    // add liquidity to well, to L2 Beanstalk:
    console.log(`Adding liquidity to ${WellAddresses[i]} and ${NonBeanToken[i]}`);
    await well
      .connect(account)
      .addLiquidity([beanAmounts[i], nonBeanAmounts[i]], 0, L2Beanstalk, MAX_UINT256);
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
