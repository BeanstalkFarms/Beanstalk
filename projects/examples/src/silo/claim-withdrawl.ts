import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";
import { Crate } from "@beanstalk/sdk/dist/types/lib/silo";

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

  await go(sdk.tokens.BEAN);

  await stop();
}

async function go(token: Token) {
  console.log(`Claiming from ${token.symbol} Silo`);

  let claimable = await sdk.silo.claim.getClaimableAmount(token);
  console.log(claimable.amount);
  console.log(claimable.crates.map((c) => c.season.toString()));

  let tx = await sdk.silo.claim.claim(token);
  await tx.wait();

  console.log("Done");
}
