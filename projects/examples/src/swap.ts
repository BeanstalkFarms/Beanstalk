import { BeanstalkSDK, ERC20Token, FarmFromMode, FarmToMode, Token } from "@beanstalk/sdk";
import { signer } from "./setup";

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  const sdk = new BeanstalkSDK({ signer, DEBUG: false });

  // await swap(sdk, sdk.tokens.USDT, sdk.tokens.USDT, "500", FarmFromMode.INTERNAL, FarmToMode.EXTERNAL);
  await swap(sdk, sdk.tokens.ETH, sdk.tokens.BEAN, "10");
  // await swap(sdk, sdk.tokens.ETH, sdk.tokens.WETH, "1");

  // await swap(sdk, sdk.tokens.BEAN, sdk.tokens.ETH, "30");
  // await estimate(sdk, sdk.tokens.ETH, sdk.tokens.WETH, "30");
}

async function swap(
  sdk: BeanstalkSDK,
  fromToken: Token,
  toToken: Token,
  _amount: string,
  fromMode: FarmFromMode = FarmFromMode.EXTERNAL,
  toMode: FarmToMode = FarmToMode.EXTERNAL
) {
  const amount = fromToken.fromHuman(_amount);
  const account = await sdk.getAccount();
  const op = sdk.swap.buildSwap(fromToken, toToken, account, fromMode, toMode);
  console.log("Built swap:", op.getDisplay());

  const est = await op.estimate(amount);
  console.log(`Estimated: ${est.toHuman()}`);

  if (fromToken.symbol !== "ETH") {
    await (await (fromToken as ERC20Token).approve(sdk.contracts.beanstalk.address, amount.toBigNumber())).wait();
  }

  const tx = await (await op.execute(amount, 1)).wait();
  console.log(`Success: ${tx.transactionHash}`);
}

async function estimate(
  sdk: BeanstalkSDK,
  fromToken: Token,
  toToken: Token,
  _amount: string,
  fromMode: FarmFromMode = FarmFromMode.EXTERNAL,
  toMode: FarmToMode = FarmToMode.EXTERNAL
) {
  const amount = fromToken.fromHuman(_amount);
  const amountRev = toToken.fromHuman(_amount);
  const account = await sdk.getAccount();
  const op = sdk.swap.buildSwap(fromToken, toToken, account, fromMode, toMode);

  // const est = await op.estimate(amount);
  // console.log(`Estimated: ${est.toHuman()}`);

  const estR = await op.estimateReversed(amountRev);
  console.log(`Estimate Reversed: ${estR.toHuman()}`);
}
