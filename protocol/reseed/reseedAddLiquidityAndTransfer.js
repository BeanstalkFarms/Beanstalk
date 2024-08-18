const { MAX_UINT256, L2_WETH, L2_WSTETH, L2_USDC } = require("../test/hardhat/utils/constants.js");
const { to18, to6 } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");
// TODO: Replace with L2 well addresses.
const WellAddresses = [
  "0x2871ac50d1FEa78421f1126619042aCBc5f3798A", // BEAN/WETH
  "0x2DDC71c375852aeDe6371Af7a708C99690339418", // BEAN/WstETH
  "0x98b20D27D21C72c5f88CdF90E808A95121f6168F" // BEAN/USDC
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
