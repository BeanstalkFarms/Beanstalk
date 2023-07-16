import { BeanstalkSDK, Clipboard, Token, TokenValue } from "@beanstalk/sdk";
import { Direction, SwapBuilder } from "@beanstalk/wells";
import chalk from "chalk";
import { account as _account, sdk, chain } from "../setup";
import { BigNumber } from "ethers";
import { getWellsFromAquifer } from "./utils";

let account: string;
let slippage: number;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  account = process.argv[3] || _account;
  await go();
}

async function go() {
  const wells = await getWellsFromAquifer(sdk, process.env.AQUIFER_ADDRESS!);
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;
  const WETH = sdk.tokens.WETH;
  const ETH = sdk.tokens.ETH;
  const DAI = sdk.tokens.DAI;

  const builder = sdk.wells.swapBuilder;
  for await (const well of wells) {
    await builder.addWell(well);
  }

  // Print the route graph
  console.log(builder.router.getGraphCode());

  slippage = 0.1;

  await swapOne(WETH, BEAN, builder);
  await swapOne(ETH, WETH, builder);
  await swapOne(WETH, ETH, builder);

  await swapOneReverse(ETH, WETH, builder);
  await swapOneReverse(WETH, ETH, builder);
  await swapOneReverse(WETH, BEAN, builder);

  await swapMulti(USDC, WETH, builder);
  await swapMulti(WETH, USDC, builder);
  await swapMulti(ETH, USDC, builder);
  await swapMulti(USDC, ETH, builder);

  await swapMultiReverse(WETH, DAI, builder);
  await swapMultiReverse(ETH, USDC, builder);
  await swapMultiReverse(USDC, ETH, builder);
}

async function swapOne(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  const amount = token1.amount(100);

  const quote = await quoter.quoteForward(amount, account, slippage);
  console.log(`Quote: ${amount.toHuman()} ${token1.symbol} ==> ${quote.amount.toHuman()} ${token2.symbol}`);
  console.log(`Gas Est: ${quote.gas.toHuman()}`);

  if (token1.symbol !== "ETH") {
    console.log(`Setting balance of ${amount.toHuman()} ${token1.symbol}`);
    await chain.setBalance(token1, account, amount);
  }

  const { doApproval, doSwap } = quote;
  if (doApproval) {
    console.log("Approving...");
    const atx = await doApproval();
    await atx.wait();
    console.log("Done approval");
  } else {
    console.log("No Approval needed");
  }

  const overrides = {};

  const stx = await doSwap(overrides); // TODO
  await stx.wait();
  console.log("Done!!!");
}

async function swapOneReverse(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  console.log(quoter.route.toString());
  const targetAmount = token2.amount(1000);

  const quote = await quoter.quoteReverse(targetAmount, account, slippage);
  console.log(`${quote.amount.toHuman()} ${quoter.fromToken.symbol} Needed to get ==> ${targetAmount.toHuman()} ${quoter.toToken.symbol}`);

  console.log(`Setting balance of ${quote.amount.toHuman()} ${token1.symbol}`);
  // This is probably wrong, we should set the balance to quote + slippage
  if (token1.symbol !== "ETH") {
    await chain.setBalance(token1, account, quote.amount);
  }

  const { doApproval, doSwap } = await quoter.prepare(account, 1, { gasLimit: 200_000 });
  if (doApproval) {
    console.log("Approving...");
    const atx = await doApproval();
    await atx.wait();
    console.log("done approval");
  } else {
    console.log("NO Approval needed");
  }

  const overrides = {};
  if (token1.symbol === "ETH") overrides.value = quote.amount.toBigNumber();

  const stx = await doSwap(overrides);

  await stx.wait();
  console.log("Done!!!");
}

async function swapMulti(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");
  console.log(quoter.route.toString());

  const amountIn = token1.amount(1000);

  const { amount, doApproval, doSwap } = await quoter.quoteForward(amountIn, account, slippage);
  console.log(`\nFull quote: ${amountIn.toHuman()} ${token1.symbol} ==> ${amount.toHuman()} ${token2.symbol}`);

  if (token1.symbol !== "ETH") {
    console.log(`Set balance: ${amountIn.toHuman()} ${token1.symbol}`);
    await chain.setBalance(token1, account, amountIn);
  }

  if (doApproval) {
    console.log("Approving...");
    const atx = await doApproval();
    await atx.wait();
    console.log("done approval");
  } else {
    console.log("NO Approval needed");
  }

  const overrides = {};
  // if (token1.symbol === "ETH") overrides.value = quote.amount.toBigNumber();

  const stx = await doSwap({ gasLimit: 500_000 });
  await stx.wait();
  console.log("Done!!!");
}

async function swapMultiReverse(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  const targetAmount = token2.amount(100);
  console.log(`Swap: x ${token1.symbol} for ${targetAmount.toHuman()} ${token2.symbol}`);

  const { amount, doSwap, doApproval } = await quoter.quoteReverse(targetAmount, account, slippage);
  const quoteWithSlippage = amount.addSlippage(slippage);
  console.log(
    `\nOverall Quote: ${amount.toHuman()} ${quoter.fromToken.symbol} Needed to get ==> ${targetAmount.toHuman()} ${quoter.toToken.symbol}`
  );

  if (token1.symbol !== "ETH") {
    console.log(`Set balance: ${quoteWithSlippage.toHuman()} ${token1.symbol}`);
    await chain.setBalance(token1, account, quoteWithSlippage);
  }

  if (doApproval) {
    console.log("Approving...");
    const atx = await doApproval();
    await atx.wait();
    console.log("done approval");
  } else {
    console.log("NO Approval needed");
  }
  const stx = await doSwap();
  await stx.wait();
  console.log("Done!!!");
}
