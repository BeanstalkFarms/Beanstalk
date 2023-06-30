import { Clipboard, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { account as _account, impersonate, chain } from "../setup";
import { WETH9__factory } from "@beanstalk/wells";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  const { sdk, stop } = await impersonate(account);

  const wellAddress = "0xa635fD1c2e67d2e6551b3037699DF2AB5B8Dba09";

  const WETH9 = WETH9__factory.connect(sdk.tokens.WETH.address, sdk.signer!);

  const pipeline = sdk.contracts.pipeline;
  const depot = sdk.contracts.depot;
  const well = await sdk.wells.getWell(wellAddress);
  console.log("Well: ", well.contract.address);
  console.log("Depot: ", depot.address);
  console.log("Pipeline: ", pipeline.address);

  const ETH = sdk.tokens.ETH;
  const WETH = sdk.tokens.WETH;
  const BEAN = sdk.tokens.BEAN;
  const fromToken = BEAN;
  const toToken = WETH;

  let amount = BEAN.amount(500);
  let recipient = account;

  const est = await well.swapFromQuote(BEAN, WETH, amount);
  console.log("Est: ", est.toHuman());
  const minAmountOut = est.subSlippage(0.1);
  console.log("Min Out: ", minAmountOut.toHuman());

  console.log("Approving Depot to spend user token");
  const ax = await fromToken.approve(depot.address, amount.toBigNumber());
  await ax.wait();
  console.log("done");

  const transfer = depot.interface.encodeFunctionData("transferToken", [fromToken.address, well.address, amount.toBigNumber(), 0, 0]);

  const unwrapWeth = {
    target: WETH9.address,
    callData: WETH9.interface.encodeFunctionData("withdraw", [minAmountOut.toBigNumber()]),
    clipboard: Clipboard.encode([])
  };

  const shift = {
    target: well.contract.address,
    callData: well.contract.interface.encodeFunctionData("shift", [WETH.address, minAmountOut.toBigNumber(), pipeline.address]),
    clipboard: Clipboard.encode([])
  };

  const pipe = depot.interface.encodeFunctionData("advancedPipe", [
    [
      shift
      // unwrapWeth
    ],
    0 // < --- VALUE!!!!
  ]);

  const tx = await depot.farm([transfer, pipe], { gasLimit: 5000000 });

  await tx.wait();

  await stop();
}
