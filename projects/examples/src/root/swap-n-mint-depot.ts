import { FarmFromMode, FarmToMode, TokenValue, TestUtils, Clipboard, DataSource, Token, Workflow, ERC20Token } from "@beanstalk/sdk";
import { ERC20 } from "@beanstalk/sdk/dist/types/constants/generated";
import { ethers } from "ethers";
import { sdk, chain, account } from "../setup";
import { logBalances } from "./log";

/**
 * Running this example (November 2022)
 *
 * 1. Turn on a local Anvil node, ideally with --fork-block-number set to a recent block.
 * 2. Deploy Beanstalk V2.1 (includes Pipeline, Roots, etc.):
 *
 *    ```
 *    const { deployV2_1 } = require("./utils/mocks")
 *    task('beanstalkV2_1', async function () {
 *      await deployV2_1()
 *    })
 *    ```
 *
 *    then:
 *
 *    `npx hardhat beanstalkV2_1 --network localhost`
 *
 * 3. Make sure the SDK is built: `yarn sdk:build` from root of this monorepo.
 * 4. `cd ./projects/examples`
 * 5. `yarn x ./src/root/from-circulating.ts`
 *
 */
export async function roots_via_swap(inputToken: Token, spender: string, amount: TokenValue) {
  ////////// Setup //////////

  const account = await sdk.getAccount();
  const depositToken = sdk.tokens.BEAN;
  console.log("Using account:", account);

  // Check `account`' balance of `inputToken`, validate `amount`
  const balance = await logBalances(account, inputToken, depositToken, "BEFORE");
  if (amount.gt(balance.total)) {
    throw new Error(`Not enough ${inputToken.symbol}. Balance: ${balance.total.toHuman()} / Input: ${amount.toHuman()}`);
  }

  // if (!(inputToken instanceof ERC20Token)) throw new Error("not supported");

  ////////// Prepare Swap //////////

  const loadPipelineFrom = FarmFromMode.EXTERNAL;
  const loadPipelineTo = FarmFromMode.EXTERNAL; // unused
  const swapTo = FarmToMode.EXTERNAL;

  // Swap from `inputToken` -> `depositToken`
  const swap = sdk.swap.buildSwap(inputToken, depositToken, account, FarmFromMode.EXTERNAL, swapTo);

  console.log("\n\n Estinating amount out from Swap...");
  const amountFromSwap = await swap.estimate(amount);
  console.log(`Swap Estimate: ${amount.toHuman()} ${inputToken.symbol} --> ${amountFromSwap.toHuman()} BEAN`);
  console.log("\n\nExtending Farm...");

  ////////// Initialize Farm //////////

  const depotFarm = sdk.farm.create<{ permit: any }>("DepotMint", "depot");

  // To perform a swap from EXTERNAL, we may need an allowance.
  // We can skip this step if:
  //    `inputToken` = ETH
  //    `inputToken.allowance(account, beanstalk) > amountInStep`
  depotFarm.add(new sdk.farm.actions.PermitERC20((context) => context.data.permit), {
    onlyExecute: true,
    skip: (amountInStep) => inputToken.hasEnoughAllowance(account, spender, amountInStep)
  });

  ////////// Load Pipeline //////////

  depotFarm.add(
    // HEADS UP: loadPipeline uses beanstalk.interface
    // Depot uses the exact same signatures as TokenFacet so this works.
    sdk.farm.presets.loadPipeline(inputToken as ERC20Token, loadPipelineFrom),
    { onlyExecute: true }
  );

  ////////// Create Advanced Pipeline //////////

  const pipe = sdk.farm.createAdvancedPipe();

  ////////// Setup Pipeline Approvals //////////

  pipe.add(
    // Approve [spender = BEANSTALK] to use [account = PIPELINE]'s `inputToken`.
    // This is needed to start the Swap process.
    function approveBean(amountInStep) {
      return pipe.wrap(
        (inputToken as ERC20Token).getContract(),
        "approve",
        [sdk.contracts.beanstalk.address, ethers.constants.MaxUint256],
        amountInStep // pass-thru
      );
    },
    {
      // hasEnoughAllowance will return true if `inputToken instance
      skip: (amountInStep) => inputToken.hasEnoughAllowance(sdk.contracts.pipeline.address, sdk.contracts.beanstalk.address, amountInStep)
    }
  );

  pipe.add(
    [
      // Swap from `inputToken` -> `depositToken`.
      ...(swap.getFarm().generators as unknown as any) // FIXME
    ],
    {
      skip: inputToken === sdk.tokens.BEAN
    }
  );

  pipe.add(
    // Get PIPELINE's current balance of `depositToken`.
    async function getBalance() {
      return {
        target: sdk.contracts.beanstalk.address,
        callData: sdk.contracts.beanstalk.interface.encodeFunctionData("getExternalBalance", [
          sdk.contracts.pipeline.address,
          depositToken.address
        ])
      };
    },
    { tag: "amountToDeposit" }
  );

  pipe.add(
    // Approve BEANSTALK to use PIPELINE's `depositToken`.
    function approveBean(amountInStep) {
      return pipe.wrap(
        depositToken.getContract(),
        "approve",
        [sdk.contracts.beanstalk.address, ethers.constants.MaxUint256],
        amountInStep // pass-thru
      );
    },
    {
      skip: (amountInStep) => depositToken.hasEnoughAllowance(sdk.contracts.pipeline.address, sdk.contracts.beanstalk.address, amountInStep)
    }
  );

  pipe.add(
    // Approve ROOT to use PIPELINE's `depositToken` Deposit.
    function approveDeposit(amountInStep) {
      return pipe.wrap(
        sdk.contracts.beanstalk,
        "approveDeposit",
        [sdk.contracts.root.address, depositToken.address, ethers.constants.MaxUint256],
        amountInStep
      );
    }
  );

  ////////// Deposit into Silo //////////

  pipe.add(async function deposit(amountInStep, context) {
    return pipe.wrap(
      sdk.contracts.beanstalk,
      "deposit",
      [/* 0 */ depositToken.address, /* 1 */ amountInStep, /* 2 */ FarmFromMode.EXTERNAL],
      amountInStep, // pass-thru
      Clipboard.encodeSlot(context.step.findTag("amountToDeposit"), 0, 1)
    );
  });

  ////////// Mint ROOT //////////

  pipe.add(
    // Notes:
    // 1. amountInStep = ESTIMATED amount from the `deposit()` in previous step
    // 2. To mint ROOT, we need to create a `DepositTransferStruct[]` which ROOT uses
    //    to transfer a deposit from PIPELINE -> itself. Since the deposit estimation returns
    //    the amount deposited (but not the corresponding `season`, `bdv`, etc.), we "mock"
    //    the deposit transfer struct using the current season.
    // 3. Tokens are sent to PIPELINE's EXTERNAL balance.
    // 4. Slippage is applied to `amountOutRoot` when this step is encoded.
    // 5. This forwards the estimated amount of ROOT minted to the next function.
    //    However, to prevent any dust left behind in PIPELINE, the transferToken
    //    function uses Clipboard to copy the return value from `mint` directly
    //    into its own calldata; if our `amountOutRoot` estimate is incorrect, the user
    //    won't accidentally leave funds behind in PIPEPINE.
    async function mintRoots(amountInStep, context) {
      const [currentSeason, estimatedDepositBDV] = await Promise.all([
        sdk.sun.getSeason(),
        sdk.silo.bdv(depositToken, depositToken.fromBlockchain(amountInStep))
      ]);

      const estimate = await sdk.root.estimateRoots(
        depositToken,
        [
          // Mock deposit for estimation.
          // Note that the season of deposit is expected to equal the current season
          // since we're depositing and minting in one transaction.
          sdk.silo.makeDepositCrate(depositToken, currentSeason, amountInStep.toString(), estimatedDepositBDV.toBlockchain(), currentSeason)
        ],
        true // isDeposit
      );

      // `estimate.amount` contains the expected number of ROOT as a TokenValue.
      const amountOutRoot = estimate.amount.toBigNumber();

      return pipe.wrap(
        sdk.contracts.root,
        "mint",
        [
          [
            // ROOT accepts multiple DepositTransferStruct for minting.
            // However in this case we only made one deposit.
            {
              token: depositToken.address,
              seasons: [currentSeason],
              amounts: ["0"] // overwritten by Clipboard
            }
          ],
          FarmToMode.EXTERNAL, // deliver to EXTERNAL
          Workflow.slip(amountOutRoot, context.data.slippage || 0) // minRootsOut
        ] as Parameters<typeof sdk.contracts.root["mint"]>,
        amountOutRoot, // pass to next step
        Clipboard.encodeSlot(context.step.findTag("amountToDeposit"), 0, 11) // slot 11 = `amounts[0]`
      );
    },
    { tag: "mint" }
  );

  ////////// Transfer ROOT back to ACCOUNT //////////

  pipe.add(
    function approveUnload(amountInStep) {
      return pipe.wrap(
        sdk.tokens.ROOT.getContract(),
        "approve",
        [sdk.contracts.beanstalk.address, ethers.constants.MaxUint256],
        amountInStep // pass-thru
      );
    },
    {
      // Only run this step if BEANSTALK doesn't have enough approval to transfer ROOT from PIPELINE.
      skip: (amountInStep) =>
        sdk.tokens.ROOT.hasEnoughAllowance(sdk.contracts.pipeline.address, sdk.contracts.beanstalk.address, amountInStep)
    }
  );

  pipe.add(function unloadPipeline(amountInStep, context) {
    sdk.debug(
      `\n\n\tUnloading estimated ${amountInStep.toString()} from PIPELINE -> ACCOUNT using data from step index = ${context.step.findTag(
        "mint"
      )} \n\n`
    );
    return pipe.wrap(
      sdk.contracts.beanstalk,
      "transferToken",
      [
        /*  36 0 */ sdk.tokens.ROOT.address,
        /*  68 1 */ account,
        /* 100 2 */ "0", // Will be overwritten by advancedData
        /* 132 3 */ FarmFromMode.EXTERNAL, // use PIPELINE's external balance
        /* 164 4 */ FarmToMode.EXTERNAL // TOOD: make this a parameter
      ],
      amountInStep,
      // Copy from previous step
      Clipboard.encodeSlot(context.step.findTag("mint"), 0, 2)
    );
  });

  depotFarm.add(pipe);

  ////////// Estimate amountOut (number of ROOT) //////////

  console.log("\n\nEstimating...");
  const amountIn = amount.toBigNumber();
  const amountOut = await depotFarm.estimate(amountIn);
  console.log("Estimated amountOut:", amountOut.toString());

  ////////// Execute Transaction //////////

  console.log("\n\nExecuting...");
  let permit;

  const ready = await inputToken.hasEnoughAllowance(account, spender, amountIn);
  if (!ready) {
    console.log("Signing a permit...");
    const data = await sdk.tokens.permitERC2612(
      account, // owner
      spender, // spender
      inputToken as ERC20Token, // inputToken
      amountIn.toString() // amount
    );
    permit = await sdk.permit.sign(account, data);
    console.log("Signed a permit: ", JSON.stringify(data, null, 2), permit);
  }

  try {
    const txn = await depotFarm.execute(amountIn, {
      slippage: 0.1, // verify
      permit // attach the permit if it's needed
    });

    console.log("Transaction submitted...", txn.hash);
    const receipt = await txn.wait();
    console.log("Transaction executed");

    TestUtils.Logger.printReceipt([sdk.contracts.beanstalk, sdk.tokens.BEAN.getContract(), sdk.contracts.root], receipt);

    await logBalances(account, inputToken, depositToken, "AFTER");
  } catch (e) {
    throw new Error(test.ethersError(e));
  }
}

(async () => {
  //await (await (sdk.tokens.USDC as ERC20Token).approve(sdk.contracts.beanstalk.address, sdk.tokens.USDC.amount(101).toBigNumber())).wait();
  const tokenIn = sdk.tokens.BEAN;
  const amountIn = tokenIn.amount(100);

  // await chain.setUSDTBalance(account, amountIn);
  // await sdk.tokens.DAI.approve(sdk.contracts.beanstalk.address, tokenIn.amount(500).toBigNumber()).then((r) => r.wait());
  await test.setBEANBalance(account, amountIn);
  // await sdk.tokens.BEAN.approve(sdk.contracts.depot.address, tokenIn.amount(500).toBigNumber()).then((r) => r.wait());

  console.log(`Approved and set initial balance to ${amountIn.toHuman()} ${tokenIn.symbol}.`);

  await roots_via_swap(tokenIn, sdk.contracts.depot.address, amountIn);
})();
