import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { getTestUtils } from "src/utils/TestUtils/provider";
import { FarmFromMode, FarmToMode } from "src/lib/farm/types";

const { sdk, account, utils } = getTestUtils();
jest.setTimeout(30000);
async function reset() {
  await utils.resetFork();
}

/////////////// Setup Tokens ///////////////

beforeAll(async () => {
  // TODO: will reset() screw up other tests (files) that run in parallel?
  await reset();

  // add a bit of each coin
  await Promise.all([
    utils.setDAIBalance(account, sdk.tokens.DAI.amount(30000)),
    utils.setUSDCBalance(account, sdk.tokens.USDC.amount(30000)),
    utils.setUSDTBalance(account, sdk.tokens.USDT.amount(30000)),
    utils.setCRV3Balance(account, sdk.tokens.CRV3.amount(30000)),
    utils.setWETHBalance(account, sdk.tokens.WETH.amount(30000)),
    utils.setBEANBalance(account, sdk.tokens.BEAN.amount(30000))
  ]);
  await utils.mine();

  // set max allowance
  await Promise.all([
    await sdk.tokens.DAI.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber()),
    await sdk.tokens.USDC.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber()),
    await sdk.tokens.USDT.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber()),
    await sdk.tokens.CRV3.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber()),
    await sdk.tokens.WETH.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber()),
    await sdk.tokens.BEAN.approve(sdk.contracts.beanstalk.address, TokenValue.MAX_UINT256.toBigNumber())
  ]);
});

/////////////// Test execution of swap routes ///////////////

describe("Swap", function () {
  // ETH, BEAN => x, using EXTERNAL as the source
  describe.each([
    // ETH => x
    [sdk.tokens.ETH, sdk.tokens.WETH],
    [sdk.tokens.ETH, sdk.tokens.USDT],
    [sdk.tokens.ETH, sdk.tokens.USDC],
    [sdk.tokens.ETH, sdk.tokens.DAI],
    // [sdk.tokens.ETH, sdk.tokens.BEAN],
    [sdk.tokens.ETH, sdk.tokens.CRV3],

    // BEAN => x
    // [sdk.tokens.BEAN, sdk.tokens.ETH],
    // [sdk.tokens.BEAN, sdk.tokens.WETH],
    [sdk.tokens.BEAN, sdk.tokens.BEAN],
    [sdk.tokens.BEAN, sdk.tokens.USDT],
    [sdk.tokens.BEAN, sdk.tokens.USDC],
    [sdk.tokens.BEAN, sdk.tokens.DAI],
    [sdk.tokens.BEAN, sdk.tokens.BEAN],
    [sdk.tokens.BEAN, sdk.tokens.CRV3]
  ])("ETH, BEAN -> Common Tokens", (tokenIn, tokenOut) => {
    it.each([
      [FarmFromMode.EXTERNAL, FarmToMode.EXTERNAL],
      [FarmFromMode.EXTERNAL, FarmToMode.INTERNAL]
    ])(`swap(${tokenIn.symbol}, ${tokenOut.symbol}, %s, %s)`, async (from, to) => {
      if (tokenOut.symbol === "ETH" && to === FarmToMode.INTERNAL) {
        return;
      }
      await swapTest(tokenIn, tokenOut, from, to);
    });
  });

  // x => BEAN, using both INTERNAL and EXTERNAL as a source
  describe.each([sdk.tokens.USDC, sdk.tokens.USDT, sdk.tokens.DAI, sdk.tokens.CRV3, sdk.tokens.BEAN])(
    "Common Tokens -> BEAN",
    (tokenIn) => {
      const BEAN = sdk.tokens.BEAN;

      beforeAll(async () => {
        await transferToFarmBalance(tokenIn, "10000");
      });

      it(`${tokenIn.symbol}:BEAN - EXTERNAL -> INTERNAL`, async () => {
        await swapTest(tokenIn, BEAN, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL, "2000");
      });
      it(`${tokenIn.symbol}:BEAN - EXTERNAL -> EXTERNAL`, async () => {
        await swapTest(tokenIn, BEAN, FarmFromMode.EXTERNAL, FarmToMode.EXTERNAL, "2000");
      });
      it(`${tokenIn.symbol}:BEAN - INTERNAL -> INTERNAL`, async () => {
        await swapTest(tokenIn, BEAN, FarmFromMode.INTERNAL, FarmToMode.INTERNAL, "2000");
      });
      it(`${tokenIn.symbol}:BEAN - INTERNAL -> EXTERNAL`, async () => {
        await swapTest(tokenIn, BEAN, FarmFromMode.INTERNAL, FarmToMode.EXTERNAL, "2000");
      });
    }
  );
});

/////////////// Helpers ///////////////

async function transferToFarmBalance(tokenIn: Token, _amount: string) {
  const tx = await sdk.contracts.beanstalk.transferToken(
    tokenIn.address,
    account,
    tokenIn.amount(_amount).toBlockchain(),
    FarmFromMode.EXTERNAL,
    FarmToMode.INTERNAL
  );
  await tx.wait();
}

/**
 * Perform and assert a swap between two tokens.
 *
 * Fails if:
 * 1. The Swap operation is invalid (i.e. the path could not be found)
 * 2. The swap did not execute successfully
 * 3. The tokenIn balance did not decrease
 * 4. The tokenOut balance did not increase
 * 5. The tokenOut balance is not greater than the desired swap amount, with some slippage tolerance
 */
async function swapTest(tokenIn: Token, tokenOut: Token, from: FarmFromMode, to: FarmToMode, _amount?: string) {
  const [tokenInBalanceBefore, tokenOutBalanceBefore] = await Promise.all([getBalance(tokenIn, from), getBalance(tokenOut, to)]);

  const v = ["ETH", "WETH"].includes(tokenIn.symbol) ? 30 : 300;
  const amount = tokenIn.fromHuman(_amount ? _amount : v);
  const slippage = 0.5;
  const amountWithSlippage = amount.pct(100 - slippage);

  // Checks there are tokens to spend
  expect(tokenInBalanceBefore.gte(amount)).toBe(true);

  // Checks the swap is valid
  const op = sdk.swap.buildSwap(tokenIn, tokenOut, account, from, to);
  expect(op.isValid()).toBe(true);

  let tx = await (await op.execute(amount, slippage)).wait();
  expect(tx.status).toBe(1);

  const [tokenInBalanceAfter, tokenOutBalanceAfter] = await Promise.all([getBalance(tokenIn, from), getBalance(tokenOut, to)]);

  // There are less tokenIn than before the swapped
  expect(tokenInBalanceAfter.lt(tokenInBalanceBefore));
  // There are more tokenOut after the swap
  expect(tokenOutBalanceAfter.gt(tokenOutBalanceBefore));
  // tokenOut balance is bigger than desired swap ammount, with some slippage tolerance
  expect(tokenOutBalanceAfter.gte(amountWithSlippage));
}

async function getBalance(token: Token, mode: string) {
  const balances = await sdk.tokens.getBalance(token, account);
  if (mode === "0") {
    return balances.external;
  }
  if (mode === "1") {
    return balances.internal;
  }
  if (mode === "all") {
    return balances.total;
  }
  throw new Error("Unknown mode");
}
