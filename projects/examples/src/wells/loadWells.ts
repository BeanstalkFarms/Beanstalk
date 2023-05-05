import { WellsSDK } from "@beanstalk/wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, provider, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;
let sdk;
let forkUtils;

// Setup multiple wells with liquidity
main()
  .catch((e) => {
    console.log("FAILED:");
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  sdk = new WellsSDK({ signer });
  forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const addresses = [
    "0x453FDB6f2e8E0098e5FdBcE1F179905a02a4b78e",
    "0x07ef4e4d451209f9b927663f1937Bc367Ba6eee2",
    "0x6502cF9a688db4C717ef864CF64fE0DdAB309C37"
  ];
  for (const a of addresses) {
    await unloadWell(sdk, a);
    await loadWell(sdk, a);
  }
}

async function unloadWell(sdk: WellsSDK, address) {
  const well = await sdk.getWell(address);
  console.log("Removing Liquidity for ", well.name);
  const bal = await well.lpToken!.getBalance(account);
  try {
    const quoteRm = await well.removeLiquidityQuote(bal);
    const tx2 = await well.removeLiquidity(bal, quoteRm, account);
    await tx2.wait();
  } catch (err) {
    // console.log(err.message);
  }
  console.log("\tDone");
}

async function loadWell(sdk: WellsSDK, address: string) {
  const beanAmount = 50_000_000;

  const a = {
    BEAN: sdk.tokens.BEAN.amount(beanAmount),
    WETH: sdk.tokens.WETH.amount(beanAmount / 2000),
    USDC: sdk.tokens.USDC.amount(beanAmount),
    DAI: bsdk.tokens.DAI.amount(beanAmount)
  };

  const well = await sdk.getWell(address);
  console.log("Setting up ", well.name);
  const tokens = await well.getTokens();

  for (const token of tokens) {
    console.log("\tSetting balance for", token.symbol);
    await forkUtils.setBalance(token.address, account, a[token.symbol]);
    await token.approve(well.address, TokenValue.MAX_UINT256);
  }

  const amounts = tokens.map((t) => a[t.symbol]);

  console.log("\tAdding liquidity");
  const quote = await well.addLiquidityQuote(amounts);
  const tx = await well.addLiquidity(amounts, quote, account);
  await tx.wait();

  const reserves = await well.getReserves();
  console.log("\tReserves: ", reserves);
  console.log("\tDone");
}
