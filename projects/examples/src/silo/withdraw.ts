import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";
import { Crate } from "@beanstalk/sdk/dist/types/lib/silo";

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

  const token = sdk.tokens.BEAN_CRV3_LP;
  const amount = token.amount(9000);

  await go(token, amount);

  await stop();
}

async function go(token: Token, amount: TokenValue) {
  const tx = await sdk.silo.withdraw.withdraw(token, amount)
  await tx.wait();

  console.log('Done');
}
