import { Well } from "../src/lib/Well";
import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { getTestUtils } from "./TestUtils/provider";
import { Aquifer, WellFunction } from "../src";
import { createWell } from "./TestUtils/setup";

const { wellsSdk, utils, account } = getTestUtils();

jest.setTimeout(30000);

beforeAll(async () => {
  await utils.resetFork();
});

describe("Swap", () => {
  describe("BEAN WETH well (two token well)", () => {
    let testBeanWethWell: Well;

    beforeAll(async () => {
      testBeanWethWell = await createWell([wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH], account);
    });

    describe.each([
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
      [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN]
    ])("valid swaps - swapFrom", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeSwapFromTest(testBeanWethWell, tokenIn, tokenOut, account, "500");
      });
    });

    describe.each([
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
      [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN]
    ])("valid swaps - swapTo", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeSwapToTest(testBeanWethWell, tokenIn, tokenOut, account, "500");
      });
    });

    describe.each([
      [wellsSdk.tokens.BEAN, wellsSdk.tokens.USDC],
      [wellsSdk.tokens.USDC, wellsSdk.tokens.BEAN]
    ])("invalid swaps", (tokenIn, tokenOut) => {
      it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
        await executeFailedSwapTest(testBeanWethWell, tokenIn, tokenOut, "1000");
      });
    });
  });

  // TODO: Will revisit this in a future PR.
  // For now, there is seemingly some issue with Wells and the way it handles >2 tokens
  // describe("BEAN WETH USDC well (three token well)", () => {
  //   let testBeanWethUsdcWell: Well;

  //   beforeAll(async () => {
  //     testBeanWethUsdcWell = await createWell([wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH, wellsSdk.tokens.USDC], account);
  //     console.log('Well address: ' + testBeanWethUsdcWell.address);
  //   });

  //   describe.each([
  //     // BEAN, WETH, USDC
  //     [wellsSdk.tokens.BEAN, wellsSdk.tokens.USDC],
  //     [wellsSdk.tokens.USDC, wellsSdk.tokens.BEAN]
  //     // [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
  //     // [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN],
  //     // [wellsSdk.tokens.WETH, wellsSdk.tokens.USDC],
  //     // [wellsSdk.tokens.USDC, wellsSdk.tokens.WETH]
  //   ])("valid swaps - swapFrom", (tokenIn, tokenOut) => {
  //     it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
  //       await executeSwapFromTest(testBeanWethUsdcWell, tokenIn, tokenOut, account, "500");
  //     });
  //   });

  //   describe.each([
  //     [wellsSdk.tokens.BEAN, wellsSdk.tokens.USDC],
  //     [wellsSdk.tokens.USDC, wellsSdk.tokens.BEAN],
  //     // [wellsSdk.tokens.BEAN, wellsSdk.tokens.WETH],
  //     // [wellsSdk.tokens.WETH, wellsSdk.tokens.BEAN],
  //     [wellsSdk.tokens.WETH, wellsSdk.tokens.USDC]
  //     // [wellsSdk.tokens.USDC, wellsSdk.tokens.WETH]
  //   ])("valid swaps - swapTo", (tokenIn, tokenOut) => {
  //     it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
  //       await executeSwapToTest(testBeanWethUsdcWell, tokenIn, tokenOut, account, "500");
  //     });
  //   });

  //   describe.each([
  //     [wellsSdk.tokens.BEAN, wellsSdk.tokens.DAI],
  //     [wellsSdk.tokens.DAI, wellsSdk.tokens.BEAN]
  //   ])("invalid swaps", (tokenIn, tokenOut) => {
  //     it(`${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
  //       await executeFailedSwapTest(testBeanWethUsdcWell, tokenIn, tokenOut, "1000");
  //     });
  //   });
  // });
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

async function executeSwapFromTest(well: Well, tokenIn: Token, tokenOut: Token, account: string, amount: string) {
  const SLIPPAGE = 0.5;

  const swapAmount = tokenIn.amount(amount);
  // Give user tokens to swap
  await utils.setBalance(tokenIn, account, swapAmount);

  const tokenInBalanceBefore = await getBalance(tokenIn, account);
  const tokenOutBalanceBefore = await getBalance(tokenOut, account);
  const amountWithSlippage = swapAmount.subSlippage(SLIPPAGE);

  // Checks there the existing balance is enough to perform the swap
  expect(tokenInBalanceBefore.gte(swapAmount)).toBe(true);

  // Checks the swap is valid using swapQuote
  // otherwise it will throw an error
  const quote = await well.swapFromQuote(tokenIn, tokenOut, swapAmount);
  expect(quote).not.toBeNull();
  expect(quote.toHuman).not.toBe("0");

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

async function executeSwapToTest(well: Well, tokenIn: Token, tokenOut: Token, account: string, amount: string) {
  const SLIPPAGE = 0.5;

  const tokenInBalanceBefore = await getBalance(tokenIn, account);
  const tokenOutBalanceBefore = await getBalance(tokenOut, account);

  const desiredAmount = tokenOut.amount(amount);
  const amountWithSlippage = desiredAmount.subSlippage(SLIPPAGE);

  // Give user tokens to swap
  await utils.setBalance(tokenIn, account, desiredAmount);

  // Checks the swap is valid using swapQuote
  // otherwise it will throw an error
  // quote is the amount of tokenIn needed to get the desired amount of tokenOut
  const quote = await well.swapToQuote(tokenIn, tokenOut, desiredAmount);
  expect(quote).not.toBeNull();

  // give user the tokens to swap
  await utils.setBalance(tokenIn, account, quote);

  const swapTxn = await well.swapTo(tokenIn, tokenOut, quote, desiredAmount, account);
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
