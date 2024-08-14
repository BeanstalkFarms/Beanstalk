const { MAX_UINT256, L2_WETH, L2_WSTETH, L2_USDC } = require("../test/hardhat/utils/constants.js");

// TODO: Replace with L2 well addresses.
const WellAddresses = [
  "0x", // BEAN/WETH
  "0x", // BEAN/WstETH
  "0x", // BEAN/USDC
]

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_USDC, // USDC
]

// TODO: replace with values. 
const nonBeanAmounts = [
  "0", // BEAN/WETH
  "0", // BEAN/WstETH
  "0", // BEAN/WeETH
]

const beanAmounts = [
  "0",
  "0",
  "0"
]

// TODO: uncomment once addresses are finalized.
async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  // console.log("-----------------------------------");
  // console.log("adds liquidity to wells and transfers to l2 beanstalk.\n");

  // const bean = await ethers.getContractFactory("MockToken", "0x", account);
  // // add liquidity and transfer to L2 Beanstalk: 
  // for(let i = 0; i < WellAddresses.length; i++) {
  //   const well = await ethers.getContractFactory("Well", wellAddresses[i], account);
  //   const wellERC20 = await ethers.getContractFactory("IERC20", WellAddresses[i], account);
  //   const token = await ethers.getContractFactory("MockToken", NonBeanToken[i], account);

  //   if (mock) {
  //     // mint tokens to add liquidity:
  //     await token.mint(account, nonBeanAmounts[i]);
  //     await bean.mint(account, beanAmounts[i]);
  //   }

  //   // add liquidity to well:
  //   await token.approve(well.address, nonBeanAmounts[i]);
  //   await bean.approve(well.address, beanAmounts[i]);
  //   await well.addLiquidity([nonBeanAmounts[i], beanAmounts[i]], 0, account, MAX_UINT256);


  //   // transfer to L2 Beanstalk:
  //   await wellERC20.transfer(L2Beanstalk, wellERC20.balanceOf(account));
  // }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
