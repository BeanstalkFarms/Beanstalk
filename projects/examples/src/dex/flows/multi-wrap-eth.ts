import { Clipboard, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";
import { account as _account, impersonate, chain } from "../../setup";
import { WETH9__factory } from "@beanstalk/sdk-wells";
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
  const depot = sdk.contracts.depot;

  const well1 = BEANWETH_WELL;
  const well2 = BEANUSDC_WELL;

  const ETH = sdk.tokens.ETH;
  const WETH = sdk.tokens.WETH;
  const BEAN = sdk.tokens.BEAN;
  const USDC = sdk.tokens.USDC;

  let amount = ETH.amount(5);
  let recipient = account;

  const est1 = await well1.swapFromQuote(WETH, BEAN, amount);
  console.log("Est BEAN: ", est1.toHuman());
  const minAmountOutBEAN1 = est1.subSlippage(0.1);
  console.log("Min BEAN Out: ", minAmountOutBEAN1.toHuman());

  const est2 = await well2.swapFromQuote(BEAN, USDC, est1);
  console.log("Est USDC: ", est2.toHuman());
  const minAmountOutUSDC = est2.subSlippage(0.1);
  console.log("Min USDC Out: ", minAmountOutUSDC.toHuman());

  const wrapEth = {
    target: WETH9.address,
    callData: WETH9.interface.encodeFunctionData("deposit"),
    clipboard: Clipboard.encode([], amount.toBigNumber())
  };

  const wethTransfer = {
    target: WETH9.address,
    callData: WETH9.interface.encodeFunctionData("transfer", [well1.address, amount.toBigNumber()]),
    clipboard: Clipboard.encode([])
  };

  const shift1 = {
    target: well1.contract.address,
    callData: well1.contract.interface.encodeFunctionData("shift", [BEAN.address, minAmountOutBEAN1.toBigNumber(), well2.address]),
    clipboard: Clipboard.encode([])
  };

  const shift2 = {
    target: well2.address,
    callData: well2.contract.interface.encodeFunctionData("shift", [USDC.address, minAmountOutUSDC.toBigNumber(), recipient]),
    clipboard: Clipboard.encode([])
  };

  const pipe = depot.interface.encodeFunctionData("advancedPipe", [[wrapEth, wethTransfer, shift1, shift2], amount.toBlockchain()]);

  const tx = await depot.farm([pipe], { value: amount.toBigNumber(), gasLimit: 5000000 });
  await tx.wait();

  console.log("DONE!");

  await stop();
}
