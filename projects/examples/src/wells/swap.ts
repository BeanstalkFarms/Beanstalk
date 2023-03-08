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

  const A = sdk.tokens.WETH;
  const B = sdk.tokens.BEAN;

  const amountA = A.amount(1);
  const amountB = B.amount(3000);

  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(A.address, account, amountA);
  await A.approve(well.address, TokenValue.MAX_UINT256);

  // await forkUtils.setBalance(B.address, account, amountB);
  // await B.approve(well.address, TokenValue.MAX_UINT256);

  // Swap From : A => B
  const quoteFrom = await well.swapFromQuote(A, B, amountA);
  console.log(`Quote: ${amountA.toHuman()} ${A.symbol} returns ${quoteFrom.toHuman()} ${B.symbol}`);
  const tx = await well.swapFrom(A, B, amountA, quoteFrom.subSlippage(0.1), account);
  await tx.wait();
  console.log('Done');
  
  // Swap To : A => B
  const quoteTo = await well.swapToQuote(A, B, amountB);
  console.log(`Quote: Need to spend ${quoteTo.toHuman()} ${A.symbol} to receive ${amountB.toHuman()} ${B.symbol}`);
  await forkUtils.setBalance(A.address, account, quoteTo.addSlippage(0.1));
  const tx2 = await well.swapTo(A, B, quoteTo.addSlippage(0.1), amountB, account);
  await tx2.wait();
  console.log('Done');
}
