import { BeanstalkSDK, Clipboard, ERC20Token, FarmFromMode, FarmToMode, Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { account as _account, impersonate, chain } from "../setup";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;
let sdk: BeanstalkSDK;
const account = process.argv[3] || _account;
console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const { sdk: _sdk, stop } = await impersonate(account);
  sdk = _sdk;

  sdk.DEBUG = false;

  await go();

  await stop();
}

async function go() {
  const fromToken = sdk.tokens.WETH;
  const toToken = sdk.tokens.BEAN;
  let amountIn = fromToken.amount(0.5);

  // approve and give
  chain.setBalance(fromToken, account, amountIn);
  fromToken.approveBeanstalk(amountIn);

  const workflow = await getWorkflow(fromToken, toToken);
  // forward
  const est = await workflow.estimate(amountIn);
  console.log(`Quote: ${toToken.fromBlockchain(est).toHuman()}`);
  const tx = await workflow.execute(amountIn, { slippage: 0.1 });
  const receipt = await tx.wait();
  // console.log(receipt);

  console.log("Done");
}

async function getWorkflow(from: Token, to: Token) {
  const workflow = sdk.farm.create("Swap");

  // Transfer from user to Well
  const transfer = new sdk.farm.actions.TransferToken(from.address, WELL_ADDRESS, FarmFromMode.EXTERNAL, FarmToMode.EXTERNAL);

  const advancedPipe = sdk.farm.createAdvancedPipe("Pipeline Well Swap");
  const swap = new sdk.farm.actions.WellShift(WELL_ADDRESS, to, account);

  advancedPipe.add(swap);

  workflow.add(transfer);
  workflow.add(advancedPipe);

  return workflow;
}
