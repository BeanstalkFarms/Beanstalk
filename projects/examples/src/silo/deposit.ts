import { BeanstalkSDK, ERC20Token, TestUtils, Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { table } from "table";

import { account as _account, impersonate, chain } from "../setup";
main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

  // Some of the claiming contract methods don't accept an (account) parameter
  // and work off of msg.sender, so we need to impersonate the passed account.
  const { sdk, stop } = await impersonate(account);
  sdk.DEBUG = false;

  await deposit(sdk.tokens.BEAN, sdk.tokens.BEAN, 2000, account, sdk);
  // await deposit(sdk.tokens.BEAN_CRV3_LP, sdk.tokens.BEAN_CRV3_LP, 2000, account, sdk);
  // await deposit(sdk.tokens.UNRIPE_BEAN, sdk.tokens.UNRIPE_BEAN, 2000, account, sdk);
  // await deposit(sdk.tokens.UNRIPE_BEAN_CRV3, sdk.tokens.UNRIPE_BEAN_CRV3, 2000, account, sdk);

  await stop();
}

async function deposit(input: Token, target: Token, _amount: number, account: string, sdk: BeanstalkSDK) {
  console.log(`Depositing ${_amount} ${input.symbol} to ${target.symbol} silo`);
  const amount = input.amount(_amount);

  chain[`set${input.symbol}Balance`](account, amount);

  await input.approveBeanstalk(amount);

  const deposit = await sdk.silo.buildDeposit(target, account);
  deposit.setInputToken(input);

  // const est = await deposit.estimate(amount);
  // console.log("Estimate:", est.toHuman());

  const txr = await deposit.execute(amount, 0.1);
  await txr.wait();

  // Show summary of actions
  // for (const s of await deposit.getSummary()) {
  //   console.log(s);
  // }
  console.log("DONE");
}
