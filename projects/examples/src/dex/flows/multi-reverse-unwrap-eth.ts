import { Clipboard, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { WETH9__factory } from "@beanstalk/sdk-wells";
import { account as _account, impersonate, chain } from "../../setup";
import { getWell, getWellsFromAquifer } from "../utils";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  throw new Error("NOT IMPLEMENTED YET");
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

  const well1 = BEANWETH_WELL;
  const well2 = BEANUSDC_WELL;

  const ETH = sdk.tokens.ETH;
  const WETH = sdk.tokens.WETH;
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;

  const fromToken = WETH;
  const middleToken = BEAN;
  const endToken = USDC;

  let amountOut = endToken.amount(1000);
  let recipient = account;

  const quote2 = await well2.swapToQuote(middleToken, endToken, amountOut);
  console.log("quote2: ", quote2.toHuman(), `${middleToken.symbol} needed to buy ${amountOut.toHuman()} ${endToken.symbol}`);
  const quote2WSlippage = quote2.addSlippage(0.1);
  console.log("quote2 slippage: ", quote2WSlippage.toHuman());

  const quote1 = await well1.swapToQuote(fromToken, middleToken, quote2WSlippage);
  console.log("quote1: ", quote1.toHuman(), `${fromToken.symbol} needed to buy ${quote2WSlippage.toHuman()} ${middleToken.symbol}`);
  const quote1WSlippage = quote1.addSlippage(0.1);
  console.log("quote1 slippage: ", quote1WSlippage.toHuman());

  const ethAmount = quote1WSlippage;

  // Wrap ETH, amount = Quote1 With Slippage
  const wrapEth = {
    target: WETH9.address,
    callData: WETH9.interface.encodeFunctionData("deposit"),
    clipboard: Clipboard.encode([], ethAmount.toBigNumber())
  };

  // well1 to spend pipeline's fromToken (WETH)
  const approve1 = {
    target: fromToken.address,
    callData: fromToken.getContract().interface.encodeFunctionData("approve", [well1.address, quote1WSlippage.toBigNumber()]),
    clipboard: Clipboard.encode([])
  };

  const approve2 = {
    target: middleToken.address,
    callData: middleToken.getContract().interface.encodeFunctionData("approve", [well2.address, quote2WSlippage.toBigNumber()]),
    clipboard: Clipboard.encode([])
  };

  const swapTo1 = {
    target: well1.contract.address,
    callData: well1.contract.interface.encodeFunctionData("swapTo", [
      fromToken.address,
      middleToken.address,
      quote1WSlippage.toBigNumber(),
      quote2WSlippage.toBigNumber(),
      pipeline.address,
      deadline(60 * 60)
    ]),
    clipboard: Clipboard.encode([])
  };

  const swapTo2 = {
    target: well2.contract.address,
    callData: well2.contract.interface.encodeFunctionData("swapTo", [
      middleToken.address,
      endToken.address,
      quote2WSlippage.toBigNumber(),
      amountOut.toBigNumber(),
      recipient,
      deadline(60 * 60)
    ]),
    clipboard: Clipboard.encode([])
  };

  const pipe = depot.interface.encodeFunctionData("advancedPipe", [
    [wrapEth, approve1, approve2, swapTo1, swapTo2],
    ethAmount.toBigNumber()
  ]);

  const tx = await depot.farm([pipe], { value: ethAmount.toBigNumber(), gasLimit: 5000000 });
  await tx.wait();

  console.log("Done");
  console.log("Test Balance:", await (await endToken.getBalance(account)).toHuman());

  await stop();
}

export const deadline = (deadlineSecondsFromNow: number) => {
  const deadlineDate = new Date();
  deadlineDate.setSeconds(deadlineDate.getSeconds() + deadlineSecondsFromNow);
  return deadlineDate.getTime();
};
