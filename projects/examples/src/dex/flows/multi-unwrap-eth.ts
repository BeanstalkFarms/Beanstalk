import { Clipboard, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { account as _account, impersonate, chain } from "../../setup";
import { WETH9__factory } from "@beanstalk/wells";
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

  const WETH9 = WETH9__factory.connect(sdk.tokens.WETH.address, sdk.signer!);
  const pipeline = sdk.contracts.pipeline;
  const depot = sdk.contracts.depot;
  console.log("Pipeline: ", pipeline.address);

  const well1 = BEANUSDC_WELL;
  const well2 = BEANWETH_WELL;

  const ETH = sdk.tokens.ETH;
  const WETH = sdk.tokens.WETH;
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;

  let amount = USDC.amount(5000);
  let recipient = account;

  const est1 = await well1.swapFromQuote(USDC, BEAN, amount);
  const minBEANout = est1.subSlippage(0.1);
  console.log("Min BEAN Out: ", minBEANout.toHuman());

  const est2 = await well2.swapFromQuote(BEAN, WETH, minBEANout);
  const minWETHOut = est2.subSlippage(0.1);
  console.log("Min WETH Out: ", minWETHOut.toHuman());

  console.log("Approving Depot to spend user token");
  const ax = await USDC.approve(depot.address, amount.toBigNumber());
  await ax.wait();
  console.log(`Giving user ${amount.toHuman()} USDC`);
  await chain.setBalance(USDC, account, amount);

  const transfer = depot.interface.encodeFunctionData("transferToken", [USDC.address, well1.address, amount.toBigNumber(), 0, 0]);
  // const transferWethToPipe = depot.interface.encodeFunctionData("transferToken", [USDC.address, well1.address, amount.toBigNumber(), 0, 0]);

  // well swap
  const shift1 = {
    target: well1.address,
    callData: well1.contract.interface.encodeFunctionData("shift", [BEAN.address, minBEANout.toBigNumber(), well2.address]),
    clipboard: Clipboard.encode([])
  };
  const shift2 = {
    target: well2.address,
    callData: well2.contract.interface.encodeFunctionData("shift", [WETH.address, minWETHOut.toBigNumber(), pipeline.address]),
    clipboard: Clipboard.encode([])
  };

  const unwrapWeth = {
    target: WETH9.address,
    callData: WETH9.interface.encodeFunctionData("withdraw", [minWETHOut.toBigNumber()]),
    clipboard: Clipboard.encode([])
  };

  const sendEth = {
    target: recipient,
    callData: "0x",
    clipboard: Clipboard.encode([], minWETHOut.toBigNumber())
  };

  const pipe = depot.interface.encodeFunctionData("advancedPipe", [
    [shift1, shift2, unwrapWeth, sendEth],
    0 // < --- VALUE!!!!
  ]);

  const tx = await depot.farm([transfer, pipe], { gasLimit: 5000000 });
  await tx.wait();

  console.log("Done");

  await stop();
}
