import { BeanstalkSDK, ERC20Token, FarmFromMode, Token, Clipboard, FarmToMode, TokenValue, Workflow } from "@beanstalk/sdk";
import chalk from "chalk";
import { BigNumber } from "ethers";

import { account as _account, impersonate } from "../setup";
import { paraSwapQuote, paraSwapTransaction, PriceRoute } from "./lib/paraswap";
let account;
main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

  // Some of the claiming contract methods don't accept an (account) parameter
  // and work off of msg.sender, so we need to impersonate the passed account.
  const { sdk, stop } = await impersonate(account);
  // sdk.DEBUG = false;

  const fromToken = sdk.tokens.USDC;
  const toToken = sdk.tokens.BEAN;
  const amount = 3000;
  await swap(sdk, fromToken, toToken, amount);

  await stop();
}

async function swap(sdk: BeanstalkSDK, fromToken: Token, toToken: Token, _amount: number) {
  const amount = fromToken.amount(_amount);
  const farm = sdk.farm.create("Swap With Paraswap");
  const pipe = sdk.farm.createAdvancedPipe();
  let paraSwapProxyContract;
  let priceRoute: PriceRoute;
  let destAmount;

  // Approval for Beanstalk contract to transfer "fromToken" from user to Pipeline
  await fromToken.approveBeanstalk(TokenValue.MAX_UINT256).then((r) => r.wait());

  farm.add(sdk.farm.presets.loadPipeline(fromToken as ERC20Token, FarmFromMode.INTERNAL_EXTERNAL), { onlyExecute: true });

  // Get quote from ParaSwap. This gives us
  // - priceRoue: routing object we must pass exactly as is back to the Paraswap TX generator
  // - destAmount: the actual quote
  // - the contract that will require an allowance
  pipe.add(
    async function getParaSwapQuote(amountInStep, context) {
      // store these in the higher scope so they can be used in a later step
      priceRoute = await paraSwapQuote(fromToken, toToken, amountInStep);
      destAmount = BigNumber.from(priceRoute.destAmount);
      paraSwapProxyContract = priceRoute.tokenTransferProxy;

      return "";
    },
    { onlyLocal: true }
  );

  // Approve Paraswap contract to spend source token from pipeline
  pipe.add(
    function approveParaSwap(amountInStep) {
      return pipe.wrap(
        fromToken.getContract()!,
        "approve",
        [paraSwapProxyContract, TokenValue.MAX_UINT256.toBigNumber()],
        amountInStep // pass-thru
      );
    },
    {
      // Only run this step if BEANSTALK doesn't have enough approval to transfer ROOT from PIPELINE.
      skip: (amountInStep) => fromToken.hasEnoughAllowance(sdk.contracts.pipeline.address, paraSwapProxyContract, amountInStep)
    }
  );

  pipe.add(
    async function buildParaSwapTransaction(amountInStep, context) {
      const slippage = context.data.slippage || 0;
      const minAmount = TokenValue.fromBlockchain(priceRoute.destAmount, priceRoute.destDecimals).pct(100 - slippage);

      // Generate call data
      const txData = await paraSwapTransaction(
        sdk.contracts.pipeline.address,
        priceRoute, // from getQuote step
        minAmount
      );

      sdk.debug("buildParaSwapTransaction() transaction Data: ", txData);
      return {
        name: "paraswap",
        amountOut: minAmount.toBigNumber(),
        prepare: () => ({
          target: txData.to,
          callData: txData.data
        }),
        decode: () => undefined,
        decodeResult: () => undefined
      };
    },
    { tag: "paraswap" }
  );

  pipe.add(async function unloadPipeline(amountInStep, context) {
    // Approval for Beanstalk to transfer "toToken" from Pipeline to user
    await toToken.approveBeanstalk(TokenValue.MAX_UINT256).then((r) => r.wait());

    return pipe.wrap(
      sdk.contracts.beanstalk,
      "transferToken",
      [
        toToken.address,
        account,
        amountInStep.toString(),
        FarmFromMode.EXTERNAL, // use PIPELINE's external balance
        FarmToMode.EXTERNAL // send to ACCOUNT's external balance
      ],
      amountInStep
    );
  });

  farm.add(pipe);

  // Estimate
  const amountOut = await farm.estimate(amount);
  console.log("Estimated amountOut:", toToken.fromBlockchain(amountOut).toHuman());

  // Run
  const txn = await farm.execute(amount, {
    slippage: 0.1
  });

  await txn.wait();
  console.log("Success!");
}
