import { Clipboard, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { account as _account, impersonate, chain } from "../../setup";
import { getWellsFromAquifer, getWell } from "../utils";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  const { sdk, stop } = await impersonate(account);

  const aquifer = process.env.AQUIFER_ADDRESS!;
  console.log(`Aquifer: ${aquifer}`);
  const wells = await getWellsFromAquifer(sdk, aquifer);

  const BEANWETH_WELL = await getWell(sdk.tokens.BEAN, sdk.tokens.WETH, wells);
  const BEANUSDC_WELL = await getWell(sdk.tokens.BEAN, sdk.tokens.USDC, wells);

  const pipeline = sdk.contracts.pipeline;
  const depot = sdk.contracts.depot;

  const well1 = BEANWETH_WELL;
  const well2 = BEANUSDC_WELL;

  const WETH = sdk.tokens.WETH;
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;

  console.log("Pipeline: ", pipeline.address);

  const fromToken = sdk.tokens.WETH;
  const toToken = sdk.tokens.BEAN;
  let amountIn = fromToken.amount(3.33);
  let recipient = account;

  const est1 = await well1.swapFromQuote(WETH, BEAN, amountIn);
  console.log("Est: ", est1.toHuman());
  const minAmountOut1 = est1.subSlippage(0.1);
  console.log("Min Out1: ", minAmountOut1.toHuman());

  const est2 = await well2.swapFromQuote(BEAN, USDC, est1);
  console.log("Est USDC: ", est2.toHuman());
  const minAmountOutUSDC = est2.subSlippage(0.1);
  console.log("Min USDC Out: ", minAmountOutUSDC.toHuman());

  const transfer = depot.interface.encodeFunctionData("transferToken", [fromToken.address, well1.address, amountIn.toBigNumber(), 0, 0]);

  // well swap
  const shift1 = {
    target: well1.address,
    callData: well1.contract.interface.encodeFunctionData("shift", [toToken.address, minAmountOut1.toBigNumber(), well2.address]),
    clipboard: Clipboard.encode([])
  };
  const shift2 = {
    target: well2.address,
    callData: well2.contract.interface.encodeFunctionData("shift", [USDC.address, minAmountOutUSDC.toBigNumber(), recipient]),
    clipboard: Clipboard.encode([])
  };

  const pipe = depot.interface.encodeFunctionData("advancedPipe", [[shift1, shift2], 0]);

  await chain.setBalance(fromToken, account, amountIn);

  const ax = await fromToken.approve(depot.address, amountIn.toBigNumber());
  await ax.wait();
  console.log("Approved");

  const tx = await depot.farm([transfer, pipe], {});
  await tx.wait();

  // console.log(tx);
  console.log("Done");
  console.log("Balance:", await (await toToken.getBalance(account)).toHuman());

  await stop();
}
