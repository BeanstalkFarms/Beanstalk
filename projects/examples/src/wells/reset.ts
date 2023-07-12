import { WellsSDK } from "@beanstalk/wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, provider, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const A = sdk.tokens.BEAN;
  const B = sdk.tokens.WETH;

  const k = 10;

  const total = 1_000_000;

  const amountA = A.amount(total / 2); // BEAN  (1:1000 ratio)
  const amountB = B.amount(total / 2 / 1677.896805); // WETH

  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(A.address, account, amountA);
  await forkUtils.setBalance(B.address, account, amountB);
  await A.approve(well.address, TokenValue.MAX_UINT256);
  await B.approve(well.address, TokenValue.MAX_UINT256);

  // Remove all liquidity
  console.log("\nRemoveLiquidity...");
  const bal = await well.lpToken!.getBalance(account);
  if (bal.gt(0)) {
    const quoteRm = await well.removeLiquidityQuote(bal);
    console.log("Remove Quote", quoteRm.map((t) => t.toHuman()).join(", "));
    const tx2 = await well.removeLiquidity(bal, quoteRm, account);
    await tx2.wait();
    console.log("Done.");
  }

  // AddLiquidity
  console.log("\nAdd Liquidity...");
  const quote = await well.addLiquidityQuote([amountA, amountB]);
  console.log(`Quote: ${quote.toHuman()} LP for (${amountA.toHuman()} ${A.symbol}, ${amountB.toHuman()} ${B.symbol})`);
  const tx = await well.addLiquidity([amountA, amountB], quote, account);
  await tx.wait();

  // Get Reserves
  const reserves = await well.getReserves();
  console.log("Reserves: ", reserves);
}
