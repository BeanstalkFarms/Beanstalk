import { BeanstalkSDK, Clipboard, Token, TokenValue } from "@beanstalk/sdk";
import { Direction, SwapBuilder } from "@beanstalk/wells";
import chalk from "chalk";
import { account as _account, sdk, chain } from "../setup";
import { BigNumber } from "ethers";

let account: string;
let slippage: number;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  account = process.argv[3] || _account;
  let a = sdk.tokens.BEAN.amount(3141.1519);
  await go();
}

async function go() {
  const bean_weth_well = await sdk.wells.getWell("0x453FDB6f2e8E0098e5FdBcE1F179905a02a4b78e");
  const bean_usdc_well = await sdk.wells.getWell("0x07ef4e4d451209f9b927663f1937Bc367Ba6eee2");
  const usdc_dai_well = await sdk.wells.getWell("0x6502cF9a688db4C717ef864CF64fE0DdAB309C37");
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;
  const WETH = sdk.tokens.WETH;
  const DAI = sdk.tokens.DAI;

  const builder = sdk.wells.swapBuilder;
  await builder.addWell(bean_weth_well);
  await builder.addWell(bean_usdc_well);
  await builder.addWell(usdc_dai_well);

  slippage = 0.1;

  // await chain.setBalance(WETH, account, WETH.amount(2));
  // await WETH.approve(bean_weth_well.address, BigNumber.from("1000000000000000000"));

  // const t = bean_weth_well.contract.interface.encodeFunctionData("swapFrom", [
  //   "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  //   "0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab",
  //   BigNumber.from("1000000000000000000"),
  //   BigNumber.from("1000082979"),
  //   "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  //   1681767174080
  // ]);
  // console.log("GOOD ONE:");
  // console.log(t);

  // const t2 = await sdk.signer?.sendTransaction({
  //   from: account,
  //   to: bean_weth_well.address,
  //   data: "0x978b24ed000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000bea0000029ad1c77d3d5d23ba2d8893db9d1efab0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000076f011d4000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000001879134f417"
  // });

  // await t2?.wait();
  // console.log("done");
  // process.exit();

  // await swapOne(WETH, BEAN, builder);
  // await swapOneReverse(WETH, BEAN, builder);
  // await swapMulti(WETH, DAI, builder);
  await swapMultiReverse(WETH, USDC, builder);
}

async function swapOne(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  const amount = token1.amount(1);

  const quote = await quoter.quoteForward(amount, slippage);
  // console.log(`${amount.toHuman()} ${token1.symbol} ==> ${quote.toHuman()} ${token2.symbol}`);

  console.log(`Setting balance of ${amount.toHuman()} ${token1.symbol}`);
  await chain.setBalance(token1, account, amount);

  const { doApproval, doSwap } = await quoter.prepare(account);
  if (doApproval) {
    console.log("Approving...");
    const atx = await doApproval();
    await atx.wait();
    console.log("Done approval");
  } else {
    console.log("No Approval needed");
  }

  const stx = await doSwap();
  await stx.wait();
  console.log("Done!!!");
}

async function swapOneReverse(token1: Token, token2: Token, builder: SwapBuilder) {
  const quote = builder.buildQuote(token1, token2, account);
  if (!quote) throw new Error("No path found");
  const targetAmount = token2.amount(1000);

  const quoteAmount = await quote.quoteReverse(targetAmount, slippage);
  console.log(`${quoteAmount.toHuman()} ${quote.fromToken.symbol} Needed to get ==> ${targetAmount.toHuman()} ${quote.toToken.symbol}`);

  console.log(`Setting balance of ${quoteAmount.toHuman()} ${token1.symbol}`);
  // This is probably wrong, we should set the balance to quoteAmount + slippage
  await chain.setBalance(token1, account, quoteAmount);

  const { doApproval, doSwap } = await quote.prepare(account, 1, { gasLimit: 200_000 });
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

async function swapMulti(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  const amount = token1.amount(5);

  const quote = await quoter.quoteForward(5, slippage);
  console.log(`\nFull quote: ${amount.toHuman()} ${token1.symbol} ==> ${quote.toHuman()} ${token2.symbol}`);

  console.log(`Set balance: ${amount.toHuman()} ${token1.symbol}`);
  await chain.setBalance(token1, account, amount);

  const { doApproval, doSwap } = await quoter.prepare(account);
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

async function swapMultiReverse(token1: Token, token2: Token, builder: SwapBuilder) {
  const quoter = builder.buildQuote(token1, token2, account);
  if (!quoter) throw new Error("No path found");

  const targetAmount = token2.amount(1000);
  console.log(`Swap: x ETH for ${targetAmount.toHuman()} ${token2.symbol}`);

  const { amount, doSwap, doApproval } = await quoter.quoteReverse(1000, account, slippage);
  const quoteWithSlippage = amount.addSlippage(slippage);
  console.log(
    `\nOverall Quote: ${amount.toHuman()} ${quoter.fromToken.symbol} Needed to get ==> ${targetAmount.toHuman()} ${quoter.toToken.symbol}`
  );

  await chain.setBalance(token1, account, quoteWithSlippage);

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
