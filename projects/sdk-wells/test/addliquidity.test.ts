import { Well } from "../src/lib/Well";
import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { getTestUtils } from "./TestUtils/provider";
import { BlockchainUtils } from "./TestUtils";
import { Aquifer, WellFunction, WellsSDK } from "../src";

const { wellsSdk, utils, account } = getTestUtils();

jest.setTimeout(30000);

let testWell: Well;
let wellLpToken: Token;
let testHelper: BlockchainUtils;
let wellsSdkInstance: WellsSDK;

beforeAll(async () => {
  await utils.resetFork();
  const { wellsSdk } = getTestUtils();
  wellsSdkInstance = wellsSdk;
  testHelper = new BlockchainUtils(wellsSdkInstance);
});

const setupWell = async (wellTokens: ERC20Token[], account: string) => {
  // Deploy test well
  const testAquifer = await Aquifer.BuildAquifer(wellsSdk);
  const wellFunction = await WellFunction.BuildConstantProduct(wellsSdk);
  const testWell = await Well.DeployViaAquifer(wellsSdk, testAquifer, wellTokens, wellFunction, []);

  // Set initial balances for all well tokens
  await Promise.all(
    wellTokens.map(async (token) => {
      await utils.setBalance(token, account, token.amount(50000));
    })
  );

  await utils.mine();

  for await (const token of wellTokens) {
    await token.approve(testWell.address, TokenValue.MAX_UINT256.toBigNumber());
  }

  return testWell;
};

describe("Add Liquidity", () => {
  beforeEach(async () => {
    testWell = await setupWell([wellsSdkInstance.tokens.BEAN, wellsSdkInstance.tokens.USDC], account);
    wellLpToken = await testWell.getLPToken();
  });

  describe("addLiquidity", () => {
    it("should obtain quote add liquidity to the Well", async () => {
      const tokenAmountsIn: TokenValue[] = [wellsSdkInstance.tokens.BEAN.amount(100), wellsSdkInstance.tokens.USDC.amount(100)];
      const minLpAmountOut = await testWell.addLiquidityQuote(tokenAmountsIn);

      const tx = await testWell.addLiquidity(tokenAmountsIn, minLpAmountOut, account);

      // Assert that the transaction succeeded
      await expect(tx).toBeDefined();

      // Assert that the LP tokens were minted and sent to the recipient
      const lpBalance = await wellLpToken.getBalance(account);
      expect(lpBalance.gt(TokenValue.ZERO)).toBeTruthy();

      // assert that the well reserves equal the amount we added to the well
      const updatedWellReserves = await testWell.getReserves();
      expect(updatedWellReserves[0].eq(tokenAmountsIn[0])).toBeTruthy();
      expect(updatedWellReserves[1].eq(tokenAmountsIn[1])).toBeTruthy();
    });
  });

  describe("addLiquidityGasEstimate", () => {
    it("should return the estimated gas needed for adding liquidity", async () => {
      const tokenAmountsIn: TokenValue[] = [wellsSdkInstance.tokens.BEAN.amount(100), wellsSdkInstance.tokens.USDC.amount(100)];
      const minLpAmountOut = await testWell.addLiquidityQuote(tokenAmountsIn);

      const gasEstimate = await testWell.addLiquidityGasEstimate(tokenAmountsIn, minLpAmountOut, account);

      // Assert that the gas estimate is greater than zero
      expect(gasEstimate.gt(TokenValue.ZERO)).toBeTruthy();
    });
  });
});
