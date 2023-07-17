import { Aquifer, WellFunction, WellsSDK, Well } from "@beanstalk/sdk-wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, provider, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";
import { getWellsFromAquifer } from "./utils";

let sdk;
let forkUtils: TestUtils.BlockchainUtils;

// Setup multiple wells with liquidity
main()
  .catch((e) => {
    console.log("FAILED:");
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  // sdk = new WellsSDK({ signer });
  forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const { aquifer, wells } = await deploy(bsdk);

  // const wells = await getWellsFromAquifer(bsdk, process.env.AQUIFER_ADDRESS || "0x0");
  for await (const well of wells) {
    console.log(`=== Processing ${well.name} ===`);
    await loadWell(bsdk.wells, well.address);
  }
  console.log("\n\n---- AQUIFER ------");
  console.log(aquifer.address);
}

async function deploy(bsdk: BeanstalkSDK) {
  const sdk = bsdk.wells; // WellsSDK
  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;
  const USDC = sdk.tokens.USDC;
  const DAI = sdk.tokens.DAI;

  const aquifer = await Aquifer.BuildAquifer(sdk);
  const { address } = await Well.DeployContract(sdk);
  const constantProduct = await WellFunction.BuildConstantProduct(sdk);

  await forkUtils.mine();

  const well1 = await aquifer.boreWell(address, [BEAN, WETH], constantProduct, []);
  await well1.loadWell();
  console.log(`Deployed: ${well1.name}`);

  const well2 = await aquifer.boreWell(address, [BEAN, USDC], constantProduct, []);
  await well2.loadWell();
  console.log(`Deployed: ${well2.name}`);

  const well3 = await aquifer.boreWell(address, [USDC, DAI], constantProduct, []);
  await well3.loadWell();
  console.log(`Deployed: ${well3.name}`);

  return { aquifer, wells: [well1, well2, well3] };
}

async function loadWell(sdk: WellsSDK, address: string) {
  const beanAmount = 50_000_000;

  const amounts = {
    BEAN: sdk.tokens.BEAN.amount(beanAmount),
    WETH: sdk.tokens.WETH.amount(beanAmount / 2000),
    USDC: sdk.tokens.USDC.amount(beanAmount),
    DAI: bsdk.tokens.DAI.amount(beanAmount)
  };

  const well = await sdk.getWell(address);
  const tokens = await well.getTokens();

  for (const token of tokens) {
    // console.log("\tSetting balance for", token.symbol);
    await forkUtils.setBalance(token.address, account, amounts[token.symbol]);
    await token.approve(well.address, amounts[token.symbol]);
  }

  const amountsArray = tokens.map((t) => amounts[t.symbol]);

  console.log("\tAdding liquidity");
  const quote = await well.addLiquidityQuote(amountsArray);
  const tx = await well.addLiquidity(amountsArray, quote, account);
  await tx.wait();

  const reserves = await well.getReserves();
  console.log("\tReserves: ", reserves.map((tv) => tv.toHuman()).join(" - "));
}
