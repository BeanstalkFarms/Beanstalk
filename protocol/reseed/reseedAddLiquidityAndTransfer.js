const { MAX_UINT256, L2_WETH, L2_WSTETH, L2_USDC } = require("../test/hardhat/utils/constants.js");
const { to18, to6 } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");
// TODO: Replace with L2 well addresses.
const WellAddresses = [
  "0x8cDa74f4e430e3AD0Da6Ab2721E74164DcE981fd", // BEAN/WETH
  "0xF95f4cEe40313dBF19F6Cc53203940A17598B3a9", // BEAN/WstETH
  "0x2FBa48E34376536fC1c14AacD49e4683Bd2055a1" // BEAN/USDC
];

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_USDC // USDC
];

// TODO: replace with values.
const nonBeanAmounts = [
  to18("1000"), // BEAN/WETH
  to18("1000"), // BEAN/WstETH
  to6("1000000") // BEAN/USDC
];

const beanAmounts = [
  to6("1000000"), // BEAN/WETH
  to6("1000000"), // BEAN/WstETH
  to6("1000000") // BEAN/USDC
];

// TODO: uncomment once addresses are finalized.
async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  console.log("-----------------------------------");
  console.log("adds liquidity to wells and transfers to l2 beanstalk.\n");

  // todo: update bean address once finalized.
  await impersonateToken("0xe64718A6d44406dE942d3d0f591E370B22263382", 6);
  const bean = await ethers.getContractAt(
    "MockToken",
    "0xe64718a6d44406de942d3d0f591e370b22263382"
  );
  // add liquidity and transfer to L2 Beanstalk:
  for (let i = 0; i < WellAddresses.length; i++) {
    console.log("test");
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
    console.log("test2");
    await token.approve(well.address, nonBeanAmounts[i]);
    await bean.approve(well.address, beanAmounts[i]);
    // add liquidity to well, to L2 Beanstalk:
    console.log("test3");
    await well
      .connect(account)
      .addLiquidity([beanAmounts[i], nonBeanAmounts[i]], 0, L2Beanstalk, MAX_UINT256);
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
