import { WellsSDK } from "@beanstalk/wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;
  const USDC = sdk.tokens.USDC;

  const beanAmount = BEAN.amount(50000);
  const wethAmount = WETH.amount(50000);
  const usdcAmount = USDC.amount(50000);

  const beanLiquidityAmount = BEAN.amount(10000);
  const wethLiquidityAmount = WETH.amount(10000);
  const usdcLiquidityAmount = USDC.amount(10000);


  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  console.log((await well.getTokens()).map((t) => t.symbol));
  console.log(`Well Function Address: ${(await well.getWellFunction()).address}`);

  // give user tokens and set allowances
  await forkUtils.setBalance(BEAN.address, account, beanAmount);
  await forkUtils.setBalance(WETH.address, account, wethAmount);
  await forkUtils.setBalance(USDC.address, account, usdcAmount);

  await BEAN.approve(well.address, TokenValue.MAX_UINT256);
  await WETH.approve(well.address, TokenValue.MAX_UINT256);
  await USDC.approve(well.address, TokenValue.MAX_UINT256);

  await forkUtils.mine();

  const alQuote = await well.addLiquidityQuote([beanLiquidityAmount, wethLiquidityAmount, usdcLiquidityAmount]);
  console.log(alQuote);
  await well.addLiquidity([beanLiquidityAmount, wethLiquidityAmount, usdcLiquidityAmount], alQuote, account);


  const from = BEAN;
  const swapAmount = from.amount(1000);
  const to = USDC;

  // Swap From : A => B
  const quoteFrom = await well.swapFromQuote(from, to, swapAmount);
  console.log(`Quote: ${swapAmount.toHuman()} ${from.symbol} returns ${quoteFrom.toHuman()} ${to.symbol}`);
  const tx = await well.swapFrom(from, to, swapAmount, quoteFrom.subSlippage(0.1), account);
  const receipt = await tx.wait();
  console.log(receipt);
  console.log('Done');

  console.log((await (to.getBalance(account))).toHuman());
  
  // // Swap To : A => B
  // const quoteTo = await well.swapToQuote(A, B, amountB);
  // console.log(`Quote: Need to spend ${quoteTo.toHuman()} ${A.symbol} to receive ${amountB.toHuman()} ${B.symbol}`);
  // await forkUtils.setBalance(A.address, account, quoteTo.addSlippage(0.1));
  // const tx2 = await well.swapTo(A, B, quoteTo.addSlippage(0.1), amountB, account);
  // await tx2.wait();
  // console.log('Done');
}
