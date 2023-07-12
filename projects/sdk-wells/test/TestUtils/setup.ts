import { ERC20Token, TokenValue } from "@beanstalk/sdk-core";
import { Well } from "../../src/lib/Well";
import { getTestUtils } from "./provider";
import { Aquifer } from "../../src/lib/Aquifer";
import { WellFunction } from "../../src/lib/WellFunction";

const { wellsSdk, utils, account } = getTestUtils();

export const createWell = async (wellTokens: ERC20Token[], account: string, aquifer?: Aquifer, liquidityAmounts?: TokenValue[]) => {
  if (!aquifer) aquifer = await Aquifer.BuildAquifer(wellsSdk);
  if (!liquidityAmounts) liquidityAmounts = wellTokens.map((token) => token.amount(50_000_000));

  const wellFunction = await WellFunction.BuildConstantProduct(wellsSdk);
  const well = await Well.DeployViaAquifer(wellsSdk, aquifer, wellTokens, wellFunction, []);

  // Set initial balances for all well tokens
  await Promise.all(
    wellTokens.map(async (token, i) => {
      await utils.setBalance(token, account, liquidityAmounts![i]);
    })
  );

  await utils.mine();

  for await (const token of wellTokens) {
    await token.approve(well.address, TokenValue.MAX_UINT256.toBigNumber());
  }

  // Add liquidity to the well

  const quote = await well.addLiquidityQuote(liquidityAmounts);
  await well.addLiquidity(liquidityAmounts, quote, account);

  return well;
};

export const createDex = async (account: string) => {
  const ETH = wellsSdk.tokens.ETH;
  const BEAN = wellsSdk.tokens.BEAN;
  const WETH = wellsSdk.tokens.WETH;
  const USDC = wellsSdk.tokens.USDC;
  const DAI = wellsSdk.tokens.DAI;
  await utils.setBalance(ETH, account, ETH.amount(50_000));
  const aquifer = await Aquifer.BuildAquifer(wellsSdk);
  console.log("Aquifer: " + aquifer.address);

  const WETH_BEAN = await createWell([WETH, BEAN], account, aquifer, [WETH.amount(25_000), BEAN.amount(50_000_000)]);
  const BEAN_USDC = await createWell([BEAN, USDC], account, aquifer);
  const USDC_DAI = await createWell([USDC, DAI], account, aquifer);

  return [WETH_BEAN, BEAN_USDC, USDC_DAI];
};
