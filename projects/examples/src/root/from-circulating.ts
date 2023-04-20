import { ERC20Token, FarmFromMode, FarmToMode, TokenValue, TokenBalance, TestUtils, Clipboard, DataSource } from "@beanstalk/sdk";
import { ethers } from "ethers";
import { sdk, chain, account } from "../setup";

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
export async function roots_from_circulating(token: ERC20Token, amount: TokenValue): Promise<TokenBalance> {
  // setup
  const account = await sdk.getAccount();
  console.log("Using account:", account);

  // verify whitelisted in silo
  // fixme: sdk.silo.isWhitelisted(token) method
  if (!sdk.tokens.siloWhitelist.has(token)) {
    throw new Error(`Token not whitelisted in the Silo: ${token.name}`);
  }

  // verify whitelisted in root
  const isRootWhitelisted = await sdk.contracts.root.whitelisted(token.address);
  if (!isRootWhitelisted) {
    throw new Error(`Token not whitelisted in Root: ${token.name}`);
  }

  // get balance and validate amount
  const balance = await sdk.tokens.getBalance(token);
  console.log(`Account ${account} has balance ${balance.total.toHuman()} ${token.symbol}`);
  if (amount.gt(balance.total)) {
    throw new Error(`Not enough ${token.symbol}. Balance: ${balance.total.toHuman()} / Input: ${amount.toHuman()}`); // .toFixed?
  }

  const amountStr = amount.toBlockchain();

  // sign permit to send `token` to Pipeline
  const permit = await sdk.permit.sign(
    account,
    sdk.tokens.permitERC2612(
      account, // owner
      sdk.contracts.beanstalk.address, // spender
      token, // token
      amountStr // amount
    )
  );

  console.log("Signed a permit: ", permit);

  // farm
  const farm = sdk.farm.create();
  const pipe = sdk.farm.createAdvancedPipe();

  farm.add(sdk.farm.presets.loadPipeline(token, FarmFromMode.EXTERNAL, permit));
  farm.add(
    pipe.add([
      (amountInStep) =>
        pipe.wrap(
          sdk.tokens.BEAN.getContract(),
          "approve",
          [sdk.contracts.beanstalk.address, ethers.constants.MaxUint256],
          amountInStep // pass-thru
        ),
      (amountInStep) =>
        pipe.wrap(
          sdk.contracts.beanstalk,
          "approveDeposit",
          [sdk.contracts.root.address, token.address, ethers.constants.MaxUint256],
          amountInStep // pass-thru
        ),
      (amountInStep) =>
        pipe.wrap(
          sdk.tokens.ROOT.getContract(),
          "approve",
          [sdk.contracts.beanstalk.address, ethers.constants.MaxUint256],
          amountInStep // pass-thru
        ),
      async (amountInStep) => {
        return pipe.wrap(sdk.contracts.beanstalk, "deposit", [token.address, amountInStep, FarmFromMode.EXTERNAL], amountInStep);
      },
      async (amountInStep) => {
        const season = await sdk.sun.getSeason();
        const amountOut = amountInStep; // FIXME
        const minAmountOut = amountInStep; // FIXME
        return pipe.wrap(
          sdk.contracts.root,
          "mint",
          [
            [
              {
                token: token.address,
                seasons: [season], // FIXME: will fail if season flips during execution
                amounts: [amountInStep] //
              }
            ],
            FarmToMode.EXTERNAL, // send tokens to PIPELINE's external balance
            minAmountOut
          ],
          amountOut // pass this to next element
        );
      },
      (amountInStep) =>
        pipe.wrap(
          sdk.contracts.beanstalk,
          "transferToken",
          [
            /*  36 */ sdk.tokens.ROOT.address,
            /*  68 */ account,
            /* 100 */ "0", // Will be overwritten by advancedData
            /* 132 */ FarmFromMode.EXTERNAL, // use PIPELINE's external balance
            /* 164 */ FarmToMode.EXTERNAL // TOOD: make this a parameter
          ],
          amountInStep,
          // Copy the first return
          Clipboard.encode([4, 32, 100])
        )
    ])
  );

  const amountIn = amount.toBigNumber();
  const amountOut = await farm.estimate(amountIn);
  console.log("Estimated amountOut:", amountOut.toString());

  // const gas = await farm.estimateGas(amountIn, 0.1);
  // console.log("Estimated gas:", gas.toString());

  // const callStatic = await farm.callStatic(amountIn, 0.1);
  // const results = farm.decodeStatic(callStatic);

  // Farm item #3   (advancedPipe)
  // Pipe item #5   (mint)
  // Get first return value
  // const mintResult = results[2][4][0];

  // console.log("Executing this transaction is expected to mint", mintResult.toString(), "ROOT");

  console.log("Executing...");
  const txn = await farm.execute(amountIn, { slippage: 0.1 });
  console.log("Transaction submitted...", txn.hash);

  const receipt = await txn.wait();
  console.log("Transaction executed");

  TestUtils.Logger.printReceipt([sdk.contracts.beanstalk, sdk.tokens.BEAN.getContract(), sdk.contracts.root], receipt);

  const accountBalanceOfBEAN = await sdk.tokens.getBalance(sdk.tokens.BEAN);
  const accountBalanceOfROOT = await sdk.tokens.getBalance(sdk.tokens.ROOT);
  const pipelineBalanceOfBEAN = await sdk.tokens.getBalance(sdk.tokens.BEAN, sdk.contracts.pipeline.address);
  const pipelineBalanceOfROOT = await sdk.tokens.getBalance(sdk.tokens.ROOT, sdk.contracts.pipeline.address);

  console.log(`(1) BEAN balance for Account :`, accountBalanceOfBEAN.total.toHuman());
  console.log(`(2) ROOT balance for Account :`, accountBalanceOfROOT.total.toHuman());
  console.log(`(3) BEAN balance for Pipeline:`, pipelineBalanceOfBEAN.total.toHuman());
  console.log(`(4) ROOT balance for Pipeline:`, pipelineBalanceOfROOT.total.toHuman());
  console.log(` ^ 3 and 4 should be 0 if Pipeline was properly unloaded.`);

  const siloBalance = await sdk.silo.getBalance(sdk.tokens.BEAN, sdk.contracts.pipeline.address, { source: DataSource.LEDGER });
  console.log(siloBalance.deposited.crates);

  return accountBalanceOfROOT;
}

(async () => {
  await chain.setBEANBalance(account, sdk.tokens.BEAN.amount(150));
  await roots_from_circulating(sdk.tokens.BEAN, sdk.tokens.BEAN.amount(124));
})();
