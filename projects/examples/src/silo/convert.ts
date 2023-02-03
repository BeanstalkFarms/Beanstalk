import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";

import chalk from "chalk";
import { account as _account, impersonate } from "../setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

let sdk:BeanstalkSDK;

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  let { sdk: _sdk, stop } = await impersonate(account);
  sdk = _sdk;
  sdk.DEBUG = false;

  
  const fromToken = sdk.tokens.BEAN
  const toToken = sdk.tokens.UNRIPE_BEAN
  const amount = fromToken.amount(2500)

  let tx = await sdk.silo.convert(fromToken, toToken, amount)
  await tx.wait();
  
  await stop();
}
