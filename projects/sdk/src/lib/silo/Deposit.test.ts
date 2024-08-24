import { Source } from "graphql";
import { sum } from "lodash";
import { Token } from "src/classes/Token";
import { getTestUtils } from "src/utils/TestUtils/provider";
import { DataSource } from "../BeanstalkSDK";
import { DepositBuilder } from "./DepositBuilder";
import { DepositOperation } from "./DepositOperation";

const { sdk, account, utils } = getTestUtils();

jest.setTimeout(30000);

const happyPaths: Record<string, string> = {
  "ETH:BEAN": "ETH -> WETH -> BEAN -> BEAN:SILO",
  "ETH:BEANETH": "ETH -> WETH -> BEANETH -> BEANETH:SILO",
  "ETH:BEANwstETH": "ETH -> WETH -> wstETH -> BEANwstETH -> BEANwstETH:SILO",

  "WETH:BEAN": "WETH -> BEAN -> BEAN:SILO",
  "WETH:BEANETH": "WETH -> BEANETH -> BEANETH:SILO",
  "WETH:BEANwstETH": "WETH -> wstETH -> BEANwstETH -> BEANwstETH:SILO",

  "wstETH:BEANETH": "wstETH -> WETH -> BEANETH -> BEANETH:SILO",
  "wstETH:BEAN": "wstETH -> BEAN -> BEAN:SILO",
  "wstETH:BEANwstETH": "wstETH -> BEANwstETH -> BEANwstETH:SILO",

  "BEAN:BEAN": "BEAN -> BEAN:SILO",
  "BEAN:BEANETH": "BEAN -> BEANETH -> BEANETH:SILO",
  "BEAN:BEANwstETH": "BEAN -> BEANwstETH -> BEANwstETH:SILO",

  "3CRV:BEAN": "3CRV -> USDC -> BEAN -> BEAN:SILO",
  "3CRV:BEANETH": "3CRV -> USDC -> BEANETH -> BEANETH:SILO",
  "3CRV:BEANwstETH": "3CRV -> USDC -> BEANwstETH -> BEANwstETH:SILO",

  "DAI:BEAN": "DAI -> BEAN -> BEAN:SILO",
  "DAI:BEANETH": "DAI -> BEANETH -> BEANETH:SILO",
  "DAI:BEANwstETH": "DAI -> BEANwstETH -> BEANwstETH:SILO",

  "USDC:BEAN": "USDC -> BEAN -> BEAN:SILO",
  "USDC:BEANETH": "USDC -> BEANETH -> BEANETH:SILO",
  "USDC:BEANwstETH": "USDC -> BEANwstETH -> BEANwstETH:SILO",

  "USDT:BEAN": "USDT -> BEAN -> BEAN:SILO",
  "USDT:BEANETH": "USDT -> BEANETH -> BEANETH:SILO",
  "USDT:BEANwstETH": "USDT -> BEANwstETH -> BEANwstETH:SILO"
};

describe("Silo Deposit", function () {
  const builder = new DepositBuilder(sdk);

  // filter out bean_3crv_lp
  const whiteListedTokens = Array.from(sdk.tokens.siloWhitelist).filter(
    (t) => t.address !== sdk.tokens.BEAN_CRV3_LP.address
  );
  const whiteListedTokensRipe = whiteListedTokens.filter((t) => !t.isUnripe);

  const depositableTokens = [
    sdk.tokens.ETH,
    sdk.tokens.WETH,
    sdk.tokens.WSTETH,
    sdk.tokens.BEAN,
    sdk.tokens.DAI,
    sdk.tokens.USDC,
    sdk.tokens.USDT,
    sdk.tokens.CRV3
  ];

  beforeAll(async () => {
    await utils.resetFork();
    await utils.setAllBalances(account, "20000");
  });

  describe("Routes correctly", () => {
    describe.each(depositableTokens)("Whitelist Token", (token: Token) => {
      it.each(whiteListedTokensRipe.map((t) => [t.symbol, t]))(
        `Deposit ${token.symbol} into %s`,
        async (symbol: string, silo: Token) => {
          const op = builder.buildDeposit(silo, account);
          op.setInputToken(token);

          // need to run an estimate first to generate the route
          await op.estimate(token.amount(10));
          const path = op.route.toString();

          const goodPath = happyPaths[`${token.symbol}:${silo.symbol}`];
          expect(path).toBe(goodPath);
        }
      );
    });
  });

  it("Estimates", async () => {
    const op = builder.buildDeposit(sdk.tokens.BEAN_WSTETH_WELL_LP, account);
    op.setInputToken(sdk.tokens.WETH);

    const estimate = await op.estimate(sdk.tokens.WETH.amount(1));

    expect(estimate.gt(0)).toBe(true);
  });

  // This test covers 2 things:
  // 1. Doing a direct deposit (urBean to urBean silo, Bean to Bean silo, Bean/3CRV lp to its silo, etc..)
  // 2. Implicitly fully tests the Bean, urBean, urBEANwstETH silos since are only direct deposit
  describe.each(whiteListedTokens)("Direct Deposit", (token: Token) => {
    const src = token.symbol;
    const dest = `${token.symbol}:SILO`;
    const op = builder.buildDeposit(token, account);

    it(`${src} -> ${dest}`, async () => {
      await testDeposit(op, token, token);
    });
  });

  describe.each(depositableTokens)("Deposit BEAN_ETH_LP", (token: Token) => {
    const dest = sdk.tokens.BEAN_ETH_WELL_LP;
    const op = builder.buildDeposit(dest, account);
    it(`${token.symbol} -> ${dest.symbol}`, async () => {
      await testDeposit(op, token, dest);
    });
  });

  describe.each(depositableTokens)("Deposit BEAN_wstETH_LP", (token: Token) => {
    const dest = sdk.tokens.BEAN_WSTETH_WELL_LP;
    const op = builder.buildDeposit(dest, account);
    it(`${token.symbol} -> ${dest.symbol}`, async () => {
      await testDeposit(op, token, dest);
    });
  });

  it("Fails to deposit non-whitelisted assets", async () => {
    const t = () => {
      const op = builder.buildDeposit(sdk.tokens.DAI, account);
    };
    expect(t).toThrow("Cannot deposit DAI, not on whitelist.");
  });

  it("Provides a summary", async () => {
    const op = builder.buildDeposit(sdk.tokens.BEAN_ETH_WELL_LP, account);
    await testDeposit(op, sdk.tokens.DAI, sdk.tokens.BEAN_ETH_WELL_LP);
    const summary = await op.getSummary();
    console.log("summary: ", summary);

    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBe(3);

    const step1 = summary[0];
    expect(step1.type).toBe(2);
    expect(step1.tokenIn?.symbol).toBe("DAI");
    expect(step1.tokenOut?.symbol).toBe("BEANETH");

    const step2 = summary[1];
    expect(step2.type).toBe(5);
    expect(step2.token?.symbol).toBe("BEANETH");

    const step3 = summary[2];
    expect(step3.type).toBe(8);
    expect(step3.stalk?.gt(500));
    expect(step3.seeds?.eq(step3.stalk));
  });
});

async function testDeposit(op: DepositOperation, source: Token, dest: Token) {
  const amount = source.amount(500);
  if (source.symbol !== "ETH") {
    await source.approveBeanstalk(amount).then((r) => r.wait());
  }
  const balanceBefore = await sdk.silo.getBalance(dest, account, { source: DataSource.LEDGER });
  op.setInputToken(source);
  await op.execute(amount, 0.5, { gasLimit: 5_000_000 }).then((r) => r.wait());
  const balanceAfter = await sdk.silo.getBalance(dest, account, { source: DataSource.LEDGER });

  expect(balanceAfter.amount.gt(balanceBefore.amount)).toBe(true);
}