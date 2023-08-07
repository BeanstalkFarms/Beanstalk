import { WellsSDK } from "@beanstalk/sdk-wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
import { signer, provider, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;

  const wethAmount = WETH.amount(30);
  const beanAmount = BEAN.amount(30 * 1000);

  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(BEAN.address, account, beanAmount);
  await BEAN.approve(well.address, TokenValue.MAX_UINT256);
  await forkUtils.setBalance(WETH.address, account, wethAmount);
  await WETH.approve(well.address, TokenValue.MAX_UINT256);

  // AddLiquidity
  // console.log('\nAdd Liquidity...');
  // const quote = await well.addLiquidityQuote([beanAmount, wethAmount]);
  // console.log(`Quote: ${quote.toHuman()} LP`);
  // const tx = await well.addLiquidity([beanAmount, wethAmount], quote, account);
  // await tx.wait();

  // Get LP Balance
  // const lpbal = await (await well.getLPToken()).getBalance(account);
  // // const lpbal = LPTOKEN.amount(100)
  // console.log("\nLP Balance: ", lpbal.toHuman());

  // Get Reserves
  const reserves = await well.getReserves();
  console.log("Reserves: ", reserves);

  // // RemoveLiquidityOne - BEAN
  // console.log('\nRemoveLiquidityOne... BEAN');
  // const quote3 = await well.removeLiquidityOneTokenQuote(LPTOKEN.amount(500), BEAN);
  // console.log(`Removing 500 LP for BEANs would give you ${quote3.toHuman()} BEANS`);
  // const tx3 = await well.removeLiquidityOneToken(LPTOKEN.amount(500), BEAN, quote3, account);
  // await tx3.wait();

  // // RemoveLiquidityOne - WETH
  // console.log('\nRemoveLiquidityOne... WETH');
  // const quote4 = await well.removeLiquidityOneTokenQuote(LPTOKEN.amount(500), WETH);
  // console.log(`Removing 500 LP for WETH would give you ${quote4.toHuman()} WETH`);
  // const tx4 = await well.removeLiquidityOneToken(LPTOKEN.amount(500), WETH, quote4, account);
  // await tx4.wait();

  // // Remove LiquidityImbalanced
  // console.log('\nLiquidityImbalanced...');
  // const quote5 = await well.removeLiquidityImbalancedQuote([BEAN.amount(1200), WETH.amount(1.5)]);
  // console.log(`${quote5.toHuman()} LP Tokens needed to remove 1200 BEAN and 1.5 ETH`);
  // const tx5 = await well.removeLiquidityImbalanced(quote5, [BEAN.amount(1200), WETH.amount(1.5)], account);
  // await tx5.wait();

  // // Skim
  // // transfer USDC and BEAN to well, see if skim returns it
  // console.log('\nSkim...');
  // const USDC = sdk.tokens.USDC;
  // await forkUtils.setBalance(USDC.address, account, 10000);
  // await USDC.approve(well.address, TokenValue.MAX_UINT256);
  // const tx6 = await (await BEAN.getContract()).transfer(well.address, BEAN.amount(444).toBigNumber());
  // await tx6.wait();
  // const tx7 = await (await USDC.getContract()).transfer(well.address, USDC.amount(444).toBigNumber());
  // await tx7.wait();

  // const tx8 = await well.skim(account);

  // RemoveLiquidity
  console.log("\nRemoveLiquidity...");
  const bal = await well.lpToken!.getBalance(account);
  const quoteRm = await well.removeLiquidityQuote(bal);
  console.log("Remove Quote", quoteRm.map((t) => t.toHuman()).join(", "));
  const tx2 = await well.removeLiquidity(bal, quoteRm, account);
  await tx2.wait();
}
