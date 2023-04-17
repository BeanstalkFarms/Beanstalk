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

  await transfer(sdk.tokens.BEAN.amount(500));

  await stop();
}

async function transfer(amount: TokenValue) {
  const destinationAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  console.log(`Transferring ${amount.toHuman()} to ${destinationAddress}`);
  const tx = await sdk.silo.transfer.transfer(amount, destinationAddress);
  await tx.wait();

  console.log('Done');
}
