import { Source } from "graphql";
import { sum } from "lodash";
import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { getTestUtils } from "src/utils/TestUtils/provider";
import { DataSource } from "../BeanstalkSDK";

const { sdk, account, utils } = getTestUtils();

sdk.source = DataSource.LEDGER;

jest.setTimeout(30000);

const convert = sdk.silo.siloConvert;
const BEAN = sdk.tokens.BEAN;
const BEANLP = sdk.tokens.BEAN_ETH_WELL_LP;
const urBEAN = sdk.tokens.UNRIPE_BEAN;
const urBEANLP = sdk.tokens.UNRIPE_BEAN_WSTETH;

describe.skip("Silo Convert", function () {
  beforeAll(async () => {
    setTokenRewards();
    await utils.resetFork();
    // set default state as p > 1
    await utils.setPriceOver1(2);
  });

  it("Validates tokens", async () => {
    const a = async () => {
      await (await convert.convert(sdk.tokens.USDC, BEANLP, TokenValue.ONE)).wait();
      throw new Error("fromToken is not whitelisted");
    };
    const b = async () => {
      await (await convert.convert(BEAN, sdk.tokens.USDC, TokenValue.ONE)).wait();
      throw new Error("fromToken is not whitelisted");
    };
    const c = async () => {
      await (await convert.convert(BEAN, BEAN, TokenValue.ONE)).wait();
      throw new Error("Cannot convert between the same token");
    };
    await expect(a).rejects.toThrow("fromToken is not whitelisted");
    await expect(b).rejects.toThrow("toToken is not whitelisted");
    await expect(c).rejects.toThrow("Cannot convert between the same token");
  });

  it("Validates amount", async () => {
    await utils.setBEANBalance(account, TokenValue.ZERO);
    const a = async () => {
      await (await convert.convert(BEAN, BEANLP, BEAN.amount(500))).wait();
    };

    await expect(a()).rejects.toThrow("Insufficient balance");
  });

  it("Calculates crates when toToken is LP", async () => {
    const currentSeason = 10_000;
    const c1 = utils.mockDepositCrate(BEAN, 9000, "500", currentSeason);
    const c2 = utils.mockDepositCrate(BEAN, 9001, "300", currentSeason);
    const c3 = utils.mockDepositCrate(BEAN, 9002, "100", currentSeason);

    // random order
    const crates = [c3, c1, c2];

    const calc1 = convert.calculateConvert(BEAN, BEANLP, BEAN.amount(850), crates, currentSeason);

    expect(calc1.crates.length).toEqual(3);
    expect(calc1.crates[0].amount.toHuman()).toEqual("100"); // takes full amount from c1
    expect(calc1.crates[0].stem.toString()).toEqual("10000"); // confirm this is c1
    expect(calc1.crates[1].amount.toHuman()).toEqual("500"); // takes full amount from c2
    expect(calc1.crates[1].stem.toString()).toEqual("10000"); // confirm this is c2
    expect(calc1.crates[2].amount.toHuman()).toEqual("250"); // takes 300 from c3
    expect(calc1.crates[2].stem.toString()).toEqual("10000"); // confirm this is c3
    expect(calc1.seeds.toHuman()).toEqual("2549.999999");
    // expect(calc1.stalk.toHuman()).toEqual("849.9999999999"); // FIX ME

    const calc2 = convert.calculateConvert(BEAN, BEANLP, BEAN.amount(400), crates, currentSeason);
    expect(calc2.crates.length).toEqual(2);
    expect(calc2.crates[0].amount.toHuman()).toEqual("100");
    expect(calc1.crates[0].stem.toString()).toEqual("10000");
    expect(calc2.crates[1].amount.toHuman()).toEqual("300");
    expect(calc1.crates[1].stem.toString()).toEqual("10000");
    expect(calc2.seeds.toHuman()).toEqual("1200");
    // expect(calc2.stalk.toHuman()).toEqual("400"); // FIX ME
  });

  it("Calculates crates when toToken is NOT LP", async () => {
    const currentSeason = 10393;
    // the bdv generated by the mock is exactly the same as the amount
    // but we need them to be slightly different for sorting to be noticeable
    const c1 = utils.mockDepositCrate(BEANLP, 10100, "2000", currentSeason);
    c1.bdv = TokenValue.fromHuman(2123, 6);
    // ratio: 2123/2000 = 1.0615

    const c2 = utils.mockDepositCrate(BEANLP, 10101, "1000", currentSeason);
    c2.bdv = TokenValue.fromHuman(1234, 6);
    // ratio: 1234/1000 = 1.234

    const c3 = utils.mockDepositCrate(BEANLP, 10102, "500", currentSeason);
    c3.bdv = TokenValue.fromHuman(534, 6);
    // ratio: 534/500 = 1.068

    // random order
    const crates = [c2, c1, c3];

    const calc1 = convert.calculateConvert(
      BEANLP,
      BEAN,
      BEANLP.amount(3000),
      crates,
      currentSeason
    );
    expect(calc1.crates.length).toEqual(3);
    expect(calc1.crates[0].amount.toHuman()).toEqual("2000"); // takes full amount from c1
    expect(calc1.crates[0].stem.toString()).toEqual("10393"); // confirm this is c1
    expect(calc1.crates[1].amount.toHuman()).toEqual("500"); // takes full amount from c2
    expect(calc1.crates[1].stem.toString()).toEqual("10393"); // confirm this is c2
    expect(calc1.crates[2].amount.toHuman()).toEqual("500"); // takes 300 from c3
    expect(calc1.crates[2].stem.toString()).toEqual("10393"); // confirm this is c3
    expect(calc1.seeds.toHuman()).toEqual("9822");
    // expect(calc1.stalk.toHuman()).toEqual("3000"); // FIX ME

    const calc2 = convert.calculateConvert(BEAN, BEANLP, BEAN.amount(2000), crates, currentSeason);
    expect(calc2.crates.length).toEqual(2);
    expect(calc2.crates[0].amount.toHuman()).toEqual("1000");
    expect(calc1.crates[0].stem.toString()).toEqual("10393");
    expect(calc2.crates[1].amount.toHuman()).toEqual("1000");
    expect(calc1.crates[1].stem.toString()).toEqual("10393");
    expect(calc2.seeds.toHuman()).toEqual("6886.5");
    // expect(calc2.stalk.toHuman()).toEqual("2000"); // FIX ME
  });

  describe.each([
    { from: BEAN, to: BEAN },
    { from: BEANLP, to: BEANLP },
    { from: urBEAN, to: urBEAN },
    { from: urBEANLP, to: urBEANLP }
  ])("Convert to self fails", (pair) => {
    const { from, to } = pair;

    it(`Convert ${from.symbol} -> ${to.symbol}`, async () => {
      const fn = async () => await (await sdk.silo.convert(from, to, from.amount(1))).wait();
      await expect(fn).rejects.toThrow("Cannot convert between the same token");
    });
  });

  describe("With balance", () => {
    beforeAll(async () => {
      await deposit(BEAN, BEAN, 500);
      await deposit(BEANLP, BEANLP, 500);
      await deposit(urBEAN, urBEAN, 500);
      await deposit(urBEANLP, urBEANLP, 500);
    }, 120_000);

    describe.each([
      { from: BEAN, to: urBEAN },
      { from: BEAN, to: urBEANLP },
      { from: BEANLP, to: urBEAN },
      { from: BEANLP, to: urBEANLP },
      { from: urBEAN, to: BEANLP },
      { from: urBEANLP, to: BEAN },
      { from: urBEANLP, to: sdk.tokens.BEAN_ETH_WELL_LP } // BEANLP
    ])("Unsupported paths", (pair) => {
      const { from, to } = pair;
      it(`Fail ${from.symbol} -> ${to.symbol}`, async () => {
        const fn = async () => await (await convert.convert(from, to, from.amount(1))).wait();
        await expect(fn).rejects.toThrow("No conversion path found");
      });
    });

    describe("DeltaB < 0", () => {
      let deltaB: TokenValue;

      beforeAll(async () => {
        // Force deltaB < 0
        // 10M bean & 1 ETH
        // await utils.setWellLiquidity(sdk.tokens.BEAN_ETH_WELL_LP, [TokenValue.fromHuman(10_000_000, 6), TokenValue.fromHuman(1, 18)]);
        await utils.setPriceUnder1(2);
        deltaB = await sdk.bean.getDeltaB();
        expect(deltaB.lt(TokenValue.ZERO)).toBe(true);
      }, 120_000);

      describe.each([
        { from: BEANLP, to: BEAN },
        { from: urBEANLP, to: urBEAN }
      ])("Converts Successfully", (pair) => {
        const { from, to } = pair;

        it.skip(`${from.symbol} -> ${to.symbol}`, async () => {
          // TODO: FIX ME. USD Oracle Fails
          const balanceBefore = await sdk.silo.getBalance(to, account);
          const { minAmountOut } = await sdk.silo.convertEstimate(from, to, from.amount(100));
          const tx = await convert.convert(from, to, from.amount(100), 0.1, { gasLimit: 5000000 });
          await tx.wait();
          const balanceAfter = await sdk.silo.getBalance(to, account);

          expect(balanceAfter.amount.gte(balanceBefore.amount.add(minAmountOut))).toBe(true);
        });
      });

      describe.each([
        { from: BEAN, to: BEANLP },
        { from: urBEAN, to: urBEANLP }
      ])("Errors correctly", (pair) => {
        const { from, to } = pair;

        it.skip(`${from.symbol} -> ${to.symbol}`, async () => {
          const fn = async () => await (await sdk.silo.convert(from, to, from.amount(100))).wait();

          // await expect(fn()).rejects.toThrow("Cannot convert this token when deltaB is < 0");
          await expect(fn).rejects.toThrow();
        });
      });
    });

    describe("DeltaB > 0", () => {
      let deltaB: TokenValue;

      beforeAll(async () => {
        // Force deltaB > 0
        // await utils.setCurveLiquidity(10_000_000, 15_000_000);
        // 100 bean & 10000 ETH
        // await utils.setWellLiquidity(sdk.tokens.BEAN_ETH_WELL_LP, [TokenValue.fromHuman(100, 6), TokenValue.fromHuman(10000, 18)]);
        await utils.setPriceOver1(2);
        deltaB = await sdk.bean.getDeltaB();
        expect(deltaB.gte(TokenValue.ZERO)).toBe(true);
      });

      describe.each([
        { from: BEAN, to: BEANLP },
        { from: urBEAN, to: urBEANLP }
      ])("Converts Successfully", (pair) => {
        const { from, to } = pair;

        it.skip(`${from.symbol} -> ${to.symbol}`, async () => {
          // TODO: FIX ME. USD Oracle Fails
          const balanceBefore = await sdk.silo.getBalance(to, account, {
            source: DataSource.LEDGER
          });
          const { minAmountOut } = await sdk.silo.convertEstimate(from, to, from.amount(100));
          const tx = await sdk.silo.convert(from, to, from.amount(100), 0.1, { gasLimit: 5000000 });
          await tx.wait();
          const balanceAfter = await sdk.silo.getBalance(to, account, {
            source: DataSource.LEDGER
          });

          expect(balanceAfter.amount.gte(balanceBefore.amount.add(minAmountOut))).toBe(true);
        });
      });

      describe.each([
        { from: BEANLP, to: BEAN },
        { from: urBEANLP, to: urBEAN }
      ])("Errors correctly", (pair) => {
        const { from, to } = pair;

        it.skip(`${from.symbol} -> ${to.symbol}`, async () => {
          const fn = async () =>
            await (
              await convert.convert(from, to, from.amount(100), 0.1, {
                gasLimit: 5000000
              })
            ).wait();
          await expect(fn).rejects.toThrow();
          // await expect(fn()).rejects.toThrow("Cannot convert this token when deltaB is >= 0");
        });
      });
    });
  });
});

async function deposit(from: Token, to: Token, _amount: number) {
  const amount = from.amount(_amount);
  await utils.setBalance(from, account, amount);
  await from.approveBeanstalk(TokenValue.MAX_UINT256);
  const txr = await sdk.silo.deposit(from, to, amount);
  await txr.wait();
}

const setTokenRewards = () => {
  sdk.tokens.BEAN.rewards = {
    seeds: sdk.tokens.SEEDS.amount(3),
    stalk: sdk.tokens.STALK.amount(1)
  };
  sdk.tokens.BEAN_ETH_WELL_LP.rewards = {
    seeds: sdk.tokens.SEEDS.amount(3),
    stalk: sdk.tokens.STALK.amount(1)
  };
  sdk.tokens.UNRIPE_BEAN.rewards = {
    seeds: sdk.tokens.SEEDS.amount(0.000001),
    stalk: sdk.tokens.STALK.amount(1)
  };
  sdk.tokens.UNRIPE_BEAN_WSTETH.rewards = {
    seeds: sdk.tokens.SEEDS.amount(0.000001),
    stalk: sdk.tokens.STALK.amount(1)
  };
};
