import { WellsSDK } from "@beanstalk/sdk-wells";
import { TestUtils } from "@beanstalk/sdk";
import { signer, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

function randomNumberBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function main() {
  // TODO: We could loop this in the future
  await generateRandomEvents();
}

/**
 * A smattering of random events, add/remove liquidity and swaps
 */
async function generateRandomEvents() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;

  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(BEAN.address, account, 10000000);
  await BEAN.approve(well.address, TokenValue.MAX_UINT256);
  await forkUtils.setBalance(WETH.address, account, 1000000);
  await WETH.approve(await well.address, TokenValue.MAX_UINT256);

  await addLiquidity(well, BEAN.amount(randomNumberBetween(100000, 500000)), WETH.amount(randomNumberBetween(100000, 500000)));
  await addLiquidity(well, BEAN.amount(randomNumberBetween(100000, 500000)), WETH.amount(randomNumberBetween(100000, 500000)));
  await addLiquidity(well, BEAN.amount(randomNumberBetween(100000, 500000)), WETH.amount(randomNumberBetween(100000, 500000)));

  await removeLiquidityOneTokenBean(well, randomNumberBetween(50, 5000));
  await removeLiquidityOneTokenBean(well, randomNumberBetween(50, 5000));
  await removeLiquidityOneTokenWeth(well, randomNumberBetween(50, 5000));
  await removeLiquidityOneTokenWeth(well, randomNumberBetween(50, 5000));

  await removeLiquidityLPToken(well, randomNumberBetween(50, 5000));
  await removeLiquidityLPToken(well, randomNumberBetween(50, 5000));
  await removeLiquidityLPToken(well, randomNumberBetween(50, 5000));

  await removeLiquidityImbalanced(well, randomNumberBetween(1, 1000), randomNumberBetween(1, 1000));

  await swap(well, sdk.tokens.WETH, sdk.tokens.WETH.amount(randomNumberBetween(50, 500)), sdk.tokens.BEAN);
  await swap(well, sdk.tokens.BEAN, sdk.tokens.BEAN.amount(randomNumberBetween(50, 5000)), sdk.tokens.WETH);
  await swap(well, sdk.tokens.WETH, sdk.tokens.WETH.amount(randomNumberBetween(50, 500)), sdk.tokens.BEAN);
  await swap(well, sdk.tokens.BEAN, sdk.tokens.BEAN.amount(randomNumberBetween(50, 5000)), sdk.tokens.WETH);
}

const swap = async (well, fromToken, fromAmount, toToken) => {
  const amountIn = fromAmount;
  const quoteFrom = await well.swapFromQuote(fromToken, toToken, fromAmount);
  console.log(`${amountIn.toHuman()} ${fromToken.symbol} returns ${quoteFrom.toHuman()} ${toToken.symbol}`);
  const tx = await well.swapFrom(fromToken, toToken, amountIn, quoteFrom.subSlippage(0.1), account);
  await tx.wait();
};

const removeLiquidityImbalanced = async (well, beanAmount, wethAmount) => {
  const sdk = new WellsSDK({ signer });
  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;
  console.log("\nLiquidityImbalanced...");
  const quote5 = await well.removeLiquidityImbalancedQuote([BEAN.amount(beanAmount), WETH.amount(wethAmount)]);
  console.log(`${quote5.toHuman()} LP Tokens needed to remove ${beanAmount} BEAN and ${wethAmount} ETH`);
  const tx5 = await well.removeLiquidityImbalanced(quote5, [BEAN.amount(beanAmount), WETH.amount(wethAmount)], account);
  await tx5.wait();
};

const removeLiquidityOneTokenWeth = async (well, amount) => {
  const sdk = new WellsSDK({ signer });
  const LPTOKEN = await (await well).getLPToken();
  const WETH = sdk.tokens.WETH;
  console.log("\nRemoveLiquidityOne... WETH");
  const quote4 = await well.removeLiquidityOneTokenQuote(LPTOKEN.amount(amount), WETH);
  console.log(`Removing ${amount} LP for WETH would give you ${quote4.toHuman()} WETH`);
  const tx4 = await well.removeLiquidityOneToken(LPTOKEN.amount(amount), WETH, quote4, account);
  await tx4.wait();
};

const removeLiquidityOneTokenBean = async (well, amount) => {
  const sdk = new WellsSDK({ signer });
  const LPTOKEN = await (await well).getLPToken();
  const BEAN = sdk.tokens.BEAN;

  console.log("\nRemoveLiquidityOne... BEAN");
  const quote3 = await well.removeLiquidityOneTokenQuote(LPTOKEN.amount(amount), BEAN);
  console.log(`Removing ${amount} LP for BEANs would give you ${quote3.toHuman()} BEANS`);
  const tx3 = await well.removeLiquidityOneToken(LPTOKEN.amount(amount), BEAN, quote3, account);
  await tx3.wait();
};

const addLiquidity = async (well, beanAmount, wethAmount) => {
  console.log("\nAdd Liquidity...");
  const quote = await well.addLiquidityQuote([beanAmount, wethAmount]);
  console.log(`Quote: ${quote.toHuman()} LP`);
  const tx = await well.addLiquidity([beanAmount, wethAmount], quote, account);
  await tx.wait();
};

const removeLiquidityLPToken = async (well, amount) => {
  console.log("\nRemoveLiquidity...");
  const LPTOKEN = await (await well).getLPToken();
  const lpTokenToRemove = LPTOKEN.amount(amount);
  const quoteRm = await well.removeLiquidityQuote(lpTokenToRemove);
  console.log("Remove Quote", quoteRm.map((t) => t.toHuman()).join(", "));
  const tx2 = await well.removeLiquidity(lpTokenToRemove, quoteRm, account);
  await tx2.wait();
};
