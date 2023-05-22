import { Well } from "../src/lib/Well";
import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { getTestUtils } from "./TestUtils/provider";
import { deployTestWellInstance } from "./TestUtils";

const { wellsSdk, utils, account } = getTestUtils();

const DAI = new ERC20Token(
  wellsSdk.chainId,
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  6,
  "DAI",
  {
    name: "DAI",
    displayDecimals: 2
  },
  wellsSdk.provider
);

jest.setTimeout(30000);

beforeAll(async () => {
  await utils.resetFork();
});

const setupWell = async (wellTokens: ERC20Token[], account: string) => {
  // Deploy test well
  const deployment = await deployTestWellInstance(wellTokens);
  const testWell = new Well(wellsSdk, deployment.wellAddress);

  // Set initial balances for all well tokens
  await Promise.all(
    wellTokens.map(async (token) => {
      await utils.setBalance(token, account, token.amount(30000));
    })
  );

  await utils.mine();

  // TODO: Why does this fail? While the original code below works?
  // for (let i = 0; i++; i < wellTokens.length) {
  //   await wellTokens[i].approve(testWell.address, TokenValue.MAX_UINT256.toBigNumber());
  // }

  // await wellTokens[0].approve(testWell.address, TokenValue.MAX_UINT256);
  // await wellTokens[1].approve(testWell.address, TokenValue.MAX_UINT256);

  // wellTokens.forEach(async (token) => {
  //   await token.approve(testWell.address, TokenValue.MAX_UINT256);
  // });

  // Original code
  await Promise.all([
    await wellsSdk.tokens.BEAN.approve(testWell.address, TokenValue.MAX_UINT256.toBigNumber()),
    await wellsSdk.tokens.WETH.approve(testWell.address, TokenValue.MAX_UINT256.toBigNumber())
  ]);

  // Add liquidity to the well
  const liquidityAmounts = wellTokens.map((token) => token.amount(10000));
  const quote = await testWell.addLiquidityQuote(liquidityAmounts);
  await testWell.addLiquidity(liquidityAmounts, quote, account);

  return testWell;
};

describe("Swap", () => {
  describe("BEAN WETH well (two token well)", () => {
    let testBeanWethWell: Well;

    beforeAll(async () => {
      testBeanWethWell = await setupWell([wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH], account);
    });

    describe.each([
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
      [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN]
    ])("valid swaps", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeSwapTest(testBeanWethWell, wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH, account, "500");
      });
    });

    // TODO: Swap "To" tests i.e. reverse swaps

    describe.each([[wellsSdk.tokens.BEAN, wellsSdk.tokens.USDC]])("invalid swaps", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeFailedSwapTest(testBeanWethWell, wellsSdk.tokens.BEAN, DAI, "1000");
      });
    });
  });

  describe("BEAN WETH USDC well (three token well)", () => {
    let testBeanWethUsdcWell: Well;

    beforeAll(async () => {
      // TODO: Use the generic setupWell function if we can solve the approval issue
      const wellTokens = [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH, wellsSdk.tokens.USDC];

      // Deploy test well
      const deployment = await deployTestWellInstance(wellTokens);
      testBeanWethUsdcWell = new Well(wellsSdk, deployment.wellAddress);

      // Set initial balances
      await Promise.all([
        utils.setWETHBalance(account, wellsSdk.tokens.WETH.amount(30000)),
        utils.setBEANBalance(account, wellsSdk.tokens.BEAN.amount(30000)),
        utils.setUSDCBalance(account, wellsSdk.tokens.USDC.amount(30000))
      ]);
      await utils.mine();

      // Set max allowance
      await Promise.all([
        await wellsSdk.tokens.WETH.approve(testBeanWethUsdcWell.address, TokenValue.MAX_UINT256.toBigNumber()),
        await wellsSdk.tokens.BEAN.approve(testBeanWethUsdcWell.address, TokenValue.MAX_UINT256.toBigNumber()),
        await wellsSdk.tokens.USDC.approve(testBeanWethUsdcWell.address, TokenValue.MAX_UINT256.toBigNumber())
      ]);

      // Add liquidity to the well
      const liquidityAmounts = [wellsSdk.tokens.BEAN.amount(10000), wellsSdk.tokens.WETH.amount(10000), wellsSdk.tokens.USDC.amount(10000)];
      const quote = await testBeanWethUsdcWell.addLiquidityQuote(liquidityAmounts);
      await testBeanWethUsdcWell.addLiquidity(liquidityAmounts, quote.subSlippage(10), account);

      const initialBeanBalance = await wellsSdk.tokens.BEAN.getBalance(account);
      expect(initialBeanBalance.toHuman()).toEqual("20000"); // initial amount less the 10000 we added to the well

      const initialWethBalance = await wellsSdk.tokens.WETH.getBalance(account);
      expect(initialWethBalance.toHuman()).toEqual("20000"); // initial amount less the 10000 we added to the well

      const initialUsdcBalance = await wellsSdk.tokens.USDC.getBalance(account);
      expect(initialUsdcBalance.toHuman()).toEqual("20000"); // initial amount less the 10000 we added to the well
    });

    describe.each([
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.USDC],
      [wellsSdk.tokens.USDC, wellsSdk.tokens.BEAN],
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
      [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN],
      [wellsSdk.tokens.WETH, wellsSdk.tokens.USDC],
      [wellsSdk.tokens.USDC, wellsSdk.tokens.WETH]
    ])("valid swaps", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeSwapTest(testBeanWethUsdcWell, wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH, account, "500");
      });
    });

    // TODO: Swap "To" tests i.e. reverse swaps

    describe.each([[wellsSdk.tokens.BEAN, DAI]])("invalid swaps", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeFailedSwapTest(testBeanWethUsdcWell, wellsSdk.tokens.BEAN, DAI, "1000");
      });
    });
  });
});

async function getBalance(token: Token, account: string) {
  return token.getBalance(account);
}

async function executeFailedSwapTest(well: Well, tokenIn: Token, tokenOut: Token, amount: string) {
  const swapAmount = tokenIn.amount(amount);

  await expect(well.swapFromQuote(tokenIn, tokenOut, swapAmount)).rejects.toThrow(
    'call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="getSwapOut(address,address,uint256)", data="0x672215de", errorArgs=[], errorName="InvalidTokens", errorSignature="InvalidTokens()", reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)'
  );
}

async function executeSwapTest(well: Well, tokenIn: Token, tokenOut: Token, account: string, amount: string) {
  const SLIPPAGE = 0.5;

  const tokenInBalanceBefore = await getBalance(tokenIn, account);
  const tokenOutBalanceBefore = await getBalance(tokenOut, account);

  const swapAmount = tokenIn.amount(amount);
  const amountWithSlippage = swapAmount.subSlippage(SLIPPAGE);

  // Checks there the existing balance is enough to perform the swap
  expect(tokenInBalanceBefore.gte(swapAmount)).toBe(true);

  // Checks the swap is valid using swapQuote
  // otherwise it will throw an error
  const quote = await well.swapFromQuote(tokenIn, tokenOut, swapAmount);
  expect(quote).not.toBeNull();

  const swapTxn = await well.swapFrom(tokenIn, tokenOut, swapAmount, quote, account);
  const tx = await swapTxn.wait();
  expect(tx.status).toBe(1);

  const tokenInBalanceAfter = await getBalance(tokenIn, account);
  const tokenOutBalanceAfter = await getBalance(tokenOut, account);

  // There are less tokenIn than before the swapped
  expect(tokenInBalanceAfter.lt(tokenInBalanceBefore));
  // There are more tokenOut after the swap
  expect(tokenOutBalanceAfter.gt(tokenOutBalanceBefore));
  // tokenOut balance is bigger than desired swap ammount, with some slippage tollerance
  expect(tokenOutBalanceAfter.gte(amountWithSlippage));
}
