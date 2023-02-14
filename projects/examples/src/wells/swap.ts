import { WellsSDK } from "@beanstalk/wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = "0xd94a92749c0bb33c4e4ba7980c6dad0e3effb720";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;

  const beanAmount = BEAN.amount(10000);
  const wethAmount = WETH.amount(3);

  // get Well object
  const well = sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(BEAN.address, account, 10000);
  await BEAN.approve(well.address, TokenValue.MAX_UINT256);
  await forkUtils.setBalance(WETH.address, account, 100);
  await WETH.approve(well.address, TokenValue.MAX_UINT256);

  // Swap From : WETH => BEAN
  const amountIn = WETH.amount(10);
  const quoteFrom = await well.swapFromQuote(WETH, BEAN, amountIn);
  console.log(`${amountIn.toHuman()} WETH returns ${quoteFrom.toHuman()} BEAN`);
  const tx = await well.swapFrom(WETH, BEAN, amountIn, quoteFrom.subSlippage(0.1), account);
  await tx.wait();

  // Swap To : WETH => BEAN
  const amountOut = BEAN.amount(3333);
  const quoteTo = await well.swapToQuote(WETH, BEAN, amountOut);
  console.log(`Need to spend ${quoteTo.toHuman()} ETH to receive ${amountOut.toHuman()} BEAN`);
  const tx2 = await well.swapTo(WETH, BEAN, quoteTo.addSlippage(0.1), amountOut, account);
  await tx2.wait();
}
