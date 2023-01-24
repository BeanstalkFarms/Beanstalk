import { BeanstalkSDK, ERC20Token, FarmFromMode, FarmToMode, Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { ethers } from "ethers";
import { table } from "table";

import { account as _account, impersonate } from "../setup";
main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  // const account = "0xC5581F1aE61E34391824779D505Ca127a4566737";
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

  // Some of the claiming contract methods don't accept an (account) parameter
  // and work off of msg.sender, so we need to impersonate the passed account.
  const { sdk, stop } = await impersonate(account);
  // const { sdk, stop } = await impersonate("0xC5581F1aE61E34391824779D505Ca127a4566737");
  sdk.DEBUG = false;

  // await swapETHtoBEAN(sdk, 1);

  // await deposit(sdk.tokens.BEAN_CRV3_LP, sdk.tokens.BEAN_CRV3_LP, 500, account, sdk);
  // await deposit(sdk.tokens.CRV3, sdk.tokens.BEAN_CRV3_LP, 400, account, sdk);
  // await deposit(sdk.tokens.BEAN, sdk.tokens.BEAN_CRV3_LP, 400, account, sdk);
  // await deposit(sdk.tokens.DAI, sdk.tokens.BEAN_CRV3_LP, 400, account, sdk);
  // await deposit(sdk.tokens.USDC, sdk.tokens.BEAN_CRV3_LP, 400, account, sdk);
  await deposit(sdk.tokens.ETH, sdk.tokens.BEAN, 1, account, sdk);
  // await deposit(sdk.tokens.CRV3, sdk.tokens.BEAN_CRV3_LP, 100, account, sdk);
  // await deposit(sdk.tokens.BEAN, sdk.tokens.BEAN, 20, account, sdk);


  await stop();
}

async function deposit(input: Token, target: Token, _amount: number, account: string, sdk: BeanstalkSDK) {
  console.log(`Depositing ${_amount} ${input.symbol} to ${target.symbol} silo`);
  const amount = input.amount(_amount);
  await input.approveBeanstalk(amount);

  const deposit = await sdk.silo.buildDeposit(target, account);
  deposit.setInputToken(input);

  const est = await deposit.estimate(amount);
  console.log("Estimate:", est.toHuman());

  const txr = await deposit.execute(amount, 0.1);
  await txr.wait();

  // Show summary of actions
  for (const s of await deposit.getSummary()) {
    console.log(s);
  }
  console.log("DONE");
}

async function swapETHtoBEAN(sdk: BeanstalkSDK, amount: number) {
  const acc = await sdk.getAccount();

  const op = sdk.swap.buildSwap(sdk.tokens.ETH, sdk.tokens.BEAN, acc, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);
  console.log("Built swap:", op.getDisplay());

  const amt = sdk.tokens.ETH.fromHuman(amount);

  const est = await op.estimate(amt);
  console.log("Estimate:", est.toHuman());

  const txn = await op.execute(amt, 1);
  const receipt = await txn.wait();
  console.log(`Success: ${receipt.transactionHash}`);

  const BEANBALANCE = await sdk.tokens.BEAN.getBalance(acc);
  console.log(`BEAN Balance: ${BEANBALANCE.toHuman()}`);
}