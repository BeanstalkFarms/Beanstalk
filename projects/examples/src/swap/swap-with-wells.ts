/**
 * This tests wells using the sdk.swap functionality
 */

import { BeanstalkSDK, ERC20Token, FarmFromMode, FarmToMode, Token } from "@beanstalk/sdk";
import { signer, chain } from "../setup";

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  const sdk = new BeanstalkSDK({ signer, DEBUG: false });
  sdk.DEBUG = true;

  await swap(sdk, sdk.tokens.ETH, sdk.tokens.BEAN, 0.25);
}

async function swap(
  sdk: BeanstalkSDK,
  fromToken: Token,
  toToken: Token,
  _amount: number,
  fromMode: FarmFromMode = FarmFromMode.EXTERNAL,
  toMode: FarmToMode = FarmToMode.EXTERNAL
) {
  const amount = fromToken.fromHuman(_amount);
  const account = await sdk.getAccount();

  // give token and approve
  chain.setBalance(fromToken, account, amount.add(0.1));
  if (fromToken.symbol !== "ETH") {
    await (await (fromToken as ERC20Token).approveBeanstalk(amount.toBigNumber())).wait();
  }

  const op = sdk.swap.buildSwap(fromToken, toToken, account, fromMode, toMode);
  console.log("Built swap:", op.getDisplay());

  const est = await op.estimate(amount);
  console.log(`Estimated: ${est.toHuman()}`);

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
