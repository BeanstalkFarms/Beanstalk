import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";

import chalk from "chalk";
import { account as _account, impersonate } from "../setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

let sdk: BeanstalkSDK;

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  let { sdk: _sdk, stop } = await impersonate(account);
  sdk = _sdk;
  sdk.DEBUG = false;
  await sdk.refresh();
  // const fromToken = sdk.tokens.UNRIPE_BEAN_WETH;
  // const toToken = sdk.tokens.BEAN_ETH_WELL_LP;
  const fromToken = sdk.tokens.UNRIPE_BEAN;
  const toToken = sdk.tokens.BEAN;

  const maxConvert = await sdk.contracts.beanstalk.getMaxAmountIn(fromToken.address, toToken.address);

  const amount = fromToken.amount(1000);
  const quote = await sdk.contracts.beanstalk.getAmountOut(fromToken.address, toToken.address, amount.toBlockchain());
  console.log(quote.toString());

  let tx = await sdk.silo.convert(fromToken, toToken, amount);
  await tx.wait();

  await stop();
}
