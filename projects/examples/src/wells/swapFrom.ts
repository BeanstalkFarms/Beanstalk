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

  const fromToken = sdk.tokens.WETH;
  const toToken = sdk.tokens.BEAN;
  const amountIn = fromToken.amount(0.25);

  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(fromToken, account, amountIn);
  await fromToken.approve(well.address, amountIn);

  // Swap From
  const quoteFrom = await well.swapFromQuote(fromToken, toToken, amountIn);
  console.log(`Quote: ${amountIn.toHuman()} ${fromToken.symbol} returns ${quoteFrom.toHuman()} ${toToken.symbol}`);
  // const tx = await well.swapFrom(fromToken, toToken, amountIn, quoteFrom.subSlippage(0.1), account);
  // await tx.wait();

  console.log("Done");
  console.log("Bean Balance:", await (await toToken.getBalance(account)).toHuman());
}
