import { BeanstalkSDK, FarmFromMode, FarmToMode } from "@beanstalk/sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const account = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  const providerUrl = "ws://localhost:8545";
  const provider = new ethers.providers.WebSocketProvider(providerUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const sdk = new BeanstalkSDK({ signer, provider });

  await run(sdk);
  // await runWithPresets(sdk);
  // await buyAndDeposit(sdk);
  // await runReverse(sdk);
}

async function run(sdk: BeanstalkSDK) {
  const work = sdk.farm.create();

  work.add([
    new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL),
    new sdk.farm.actions.Exchange(
      sdk.contracts.curve.pools.tricrypto2.address,
      sdk.contracts.curve.registries.cryptoFactory.address,
      sdk.tokens.WETH,
      sdk.tokens.USDT
    ),
    new sdk.farm.actions.ExchangeUnderlying(
      sdk.contracts.curve.pools.beanCrv3.address,
      sdk.tokens.USDT,
      sdk.tokens.BEAN,
      undefined,
      FarmToMode.EXTERNAL
    )
  ]);

  // Run it forward
  const amountIn = ethers.utils.parseUnits("10", 18);

  const estimate = await work.estimate(amountIn);
  console.log("Estimated BEAN: ", sdk.tokens.BEAN.toHuman(estimate));

  const tx = await work.execute(amountIn, { slippage: 0.1 });
  await tx.wait();
  console.log("tx done");
}

async function runWithPresets(sdk: BeanstalkSDK) {
  const work = sdk.farm.create();

  work.add([
    new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL),
    /////// USING presets

    sdk.farm.presets.weth2usdt(),
    sdk.farm.presets.usdt2bean()

    ///// OR with Preset flow
    // sdk.farm.presets.weth2bean(),
  ]);

  const amountIn = ethers.utils.parseUnits("10", 18);

  const estimate = await work.estimate(amountIn);
  console.log("Estimated BEAN: ", sdk.tokens.BEAN.toHuman(estimate));

  const tx = await work.execute(amountIn, { slippage: 0.1 });
  await tx.wait();
  console.log("tx done");
}

async function buyAndDeposit(sdk: BeanstalkSDK) {
  const work = sdk.farm.create();

  work.add([
    new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL),
    sdk.farm.presets.weth2bean(FarmFromMode.INTERNAL, FarmToMode.INTERNAL),
    async (_amountInStep) => {
      return sdk.contracts.beanstalk.interface.encodeFunctionData("deposit", [
        sdk.tokens.BEAN.address,
        _amountInStep,
        FarmFromMode.INTERNAL
      ]);
    }
  ]);

  const amountIn = ethers.utils.parseUnits("10", 18);

  const estimate = await work.estimate(amountIn);
  console.log("Estimated BEAN: ", sdk.tokens.BEAN.toHuman(estimate));

  console.log(`Approving BEAN for ${estimate.toString()}`);
  await sdk.tokens.BEAN.approve(sdk.contracts.beanstalk.address, estimate);

  // TODO FIX ME
  // const test = await work.callStatic(amountIn, 0.1);
  // console.log(test);

  const tx = await work.execute(amountIn, { slippage: 0.1 });
  await tx.wait();
  console.log("tx done");
}

async function runReverse(sdk: BeanstalkSDK) {
  const work = sdk.farm.create();

  work.add([
    new sdk.farm.actions.WrapEth(),
    new sdk.farm.actions.Exchange(
      sdk.contracts.curve.pools.tricrypto2.address,
      sdk.contracts.curve.registries.cryptoFactory.address,
      sdk.tokens.WETH,
      sdk.tokens.USDT
    ),
    new sdk.farm.actions.ExchangeUnderlying(
      sdk.contracts.curve.pools.beanCrv3.address,
      sdk.tokens.USDT,
      sdk.tokens.BEAN,
      undefined,
      FarmToMode.EXTERNAL
    )
  ]);

  const amountIn = ethers.utils.parseUnits("5000", 6);

  const estimate = await work.estimateReversed(amountIn);

  console.log("Estimated ETH: ", sdk.tokens.ETH.toHuman(estimate));

  const tx = await work.execute(estimate, { slippage: 0.1 });
  await tx.wait();
  console.log("tx done");
}
