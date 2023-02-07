import { expect } from "@jest/globals";
import { BigNumber } from "ethers";
import { TokenValue } from "./TokenValue";

describe("TokenValues", function () {
  describe("Instatiation", () => {
    describe("fromHuman()", () => {
      it("fromHuman(string)", () => {
        expect(TokenValue.fromHuman("3", 6)).toMatchTokenValue(6, "3", BigNumber.from("3000000"));
        expect(TokenValue.fromHuman("3140000", 6)).toMatchTokenValue(6, "3140000", BigNumber.from("3140000000000"));
      });
      it("fromHuman(number)", () => {
        expect(TokenValue.fromHuman(3, 6)).toMatchTokenValue(6, "3", BigNumber.from("3000000"));
        expect(TokenValue.fromHuman(3140000, 6)).toMatchTokenValue(6, "3140000", BigNumber.from("3140000000000"));
      });
      it("fromHuman(BigNumber)", () => {
        const bn = BigNumber.from("3140000");
        expect(TokenValue.fromHuman(bn, 6)).toMatchTokenValue(6, "3140000", BigNumber.from("3140000000000"));
      });
    });

    describe("fromBlockchain()", () => {
      it("fromBlockchain(string)", () => {
        expect(TokenValue.fromBlockchain("3", 6)).toMatchTokenValue(6, "0.000003", BigNumber.from(3));
        expect(TokenValue.fromBlockchain("3140000", 6)).toMatchTokenValue(6, "3.14", BigNumber.from(3140000));
      });
      it("fromBlockchain(number)", () => {
        expect(TokenValue.fromBlockchain(3, 6)).toMatchTokenValue(6, "0.000003", BigNumber.from(3));
        expect(TokenValue.fromBlockchain(3140000, 6)).toMatchTokenValue(6, "3.14", BigNumber.from(3140000));
      });
      it("fromBlockchain(BigNumber)", () => {
        expect(TokenValue.fromBlockchain(BigNumber.from("3140000"), 6)).toMatchTokenValue(6, "3.14");
      });
    });

    describe("from()", () => {
      it("from(other)", () => {
        // @ts-ignore
        expect(() => TokenValue.from(BigNumber.from(3140000))).toThrow();
        // @ts-ignore
        expect(() => TokenValue.from(3140000)).toThrow();
        // @ts-ignore
        expect(() => TokenValue.from("3140000")).toThrow();
        // @ts-ignore
        expect(() => TokenValue.from(BigNumber.from("1"))).toThrow();
      });
    });

    it("blocks constructor", () => {
      expect(() => {
        new TokenValue({}, BigNumber.from(1), 1);
      }).toThrow("Do not create an instance via the constructor");
    });
  });

  it("value are immutable", () => {
    const t = TokenValue.fromHuman("123", 1);
    expect(t.decimals).toBe(1);
    expect(() => (t.decimals = 2)).toThrow("Cannot assign to read only property");
    // @ts-ignore
    expect(() => (t.value = 2)).toThrow("Cannot assign to read only property");
  });

  it("static constant values", () => {
    expect(TokenValue.ZERO.toBigNumber()._hex).toBe("0x00");
    expect(TokenValue.ONE.toBigNumber()._hex).toBe("0x01");
    expect(TokenValue.NEGATIVE_ONE.toBigNumber()._hex).toBe("-0x01");
    expect(TokenValue.MAX_UINT256.toBigNumber()._hex).toBe("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    expect(TokenValue.MAX_UINT32.toBigNumber()._hex).toBe("0xffffffff");
    expect(TokenValue.MAX_UINT32.toBlockchain()).toBe("4294967295");
  });

  it("reDecimal()", () => {
    expect(TokenValue.fromHuman("3.14", 2).reDecimal(0)).toMatchTokenValue(0, "3", BigNumber.from("3"));
    expect(TokenValue.fromHuman("3.14", 2).reDecimal(1)).toMatchTokenValue(1, "3.1", BigNumber.from("31"));
    expect(TokenValue.fromHuman("3.14", 2).reDecimal(2)).toMatchTokenValue(2, "3.14", BigNumber.from("314"));
    expect(TokenValue.fromHuman("3.14", 2).reDecimal(3)).toMatchTokenValue(3, "3.14", BigNumber.from("3140"));
    expect(TokenValue.fromHuman("3.14", 2).reDecimal(4)).toMatchTokenValue(4, "3.14", BigNumber.from("31400"));
  });

  it("add", () => {
    expect(TokenValue.fromHuman("100", 6).add(TokenValue.fromHuman("3.14", 1))).toMatchTokenValue(6, "103.1");
    expect(TokenValue.fromHuman("100", 6).add(TokenValue.fromHuman("3.14", 2))).toMatchTokenValue(6, "103.14");
    expect(TokenValue.fromHuman("100", 6).add(1)).toMatchTokenValue(6, "101");
    expect(TokenValue.fromHuman("100", 6).add(1.5)).toMatchTokenValue(6, "101.5");
    expect(TokenValue.fromHuman("100", 6).add(1.5)).toMatchTokenValue(6, "101.5");
    expect(TokenValue.fromHuman("100", 0).add(1.5)).toMatchTokenValue(1, "101.5");
    expect(TokenValue.fromHuman("100", 0).add(-50.4)).toMatchTokenValue(1, "49.6");
    expect(TokenValue.fromHuman("100", 0).add(BigNumber.from("300"))).toMatchTokenValue(0, "400");
    expect(TokenValue.fromHuman("100", 2).add(BigNumber.from("300"))).toMatchTokenValue(2, "400");
    expect(TokenValue.fromBlockchain(BigNumber.from("3140000"), 6).add(BigNumber.from("100"))).toMatchTokenValue(6, "103.14");
  });

  it("sub", () => {
    expect(TokenValue.fromHuman("100.5", 6).sub(2.5)).toMatchTokenValue(6, "98", BigNumber.from("98000000"));
    expect(TokenValue.fromHuman("100.5", 6).sub(-2.5)).toMatchTokenValue(6, "103", BigNumber.from("103000000"));
    expect(TokenValue.fromHuman("100.5", 6).sub(BigNumber.from(1))).toMatchTokenValue(6, "99.5", BigNumber.from("99500000"));
    // effectively 100.5 - 50
    expect(TokenValue.fromHuman("100.5", 6).sub(TokenValue.fromHuman("50.5", 0))).toMatchTokenValue(6, "50.5", BigNumber.from("50500000"));
    // effectively 100.5 - 50.5
    expect(TokenValue.fromHuman("100.5", 6).sub(TokenValue.fromHuman("50.5", 6))).toMatchTokenValue(6, "50", BigNumber.from("50000000"));
    // TODO: is this right??!!
    expect(TokenValue.fromHuman("100.5", 6).sub(TokenValue.fromHuman("50.5", 7))).toMatchTokenValue(7, "50", BigNumber.from("500000000"));
  });

  it("mul", () => {
    expect(TokenValue.fromHuman("100", 6).mul(0.25)).toMatchTokenValue(6, "25", BigNumber.from("25000000"));
    expect(TokenValue.fromHuman("100", 6).mul(1.5)).toMatchTokenValue(6, "150", BigNumber.from("150000000"));
    expect(TokenValue.fromHuman("100", 6).mul(3)).toMatchTokenValue(6, "300", BigNumber.from("300000000"));
    expect(TokenValue.fromHuman("100", 6).mul(-3.14)).toMatchTokenValue(6, "-314", BigNumber.from("-314000000"));
    expect(TokenValue.fromHuman("100.5", 6).mul(TokenValue.fromHuman("1.5", 2))).toMatchTokenValue(
      6,
      "150.75",
      BigNumber.from("150750000")
    );
    expect(TokenValue.fromHuman("100.5", 6).mul(TokenValue.fromHuman("1.123456789", 9))).toMatchTokenValue(
      6,
      "112.907407",
      BigNumber.from("112907407")
    );
    expect(TokenValue.fromHuman("100.5", 1).mul(TokenValue.fromHuman("1.123456789", 9))).toMatchTokenValue(
      1,
      "112.9",
      BigNumber.from("1129")
    );
    expect(TokenValue.fromHuman("100.5", 0).mul(TokenValue.fromHuman("1.123456789", 9))).toMatchTokenValue(0, "112", BigNumber.from("112"));
  });

  it("mod", () => {
    expect(TokenValue.fromHuman("100.5", 6).mod(TokenValue.fromHuman(2, 6))).toMatchTokenValue(6, "0.5", BigNumber.from("500000"));
    expect(TokenValue.fromHuman("100.5", 6).mod(2)).toMatchTokenValue(6, "0.5", BigNumber.from("500000"));
    expect(TokenValue.fromHuman("4", 10).mod(TokenValue.fromHuman(3, 6))).toMatchTokenValue(10, "1", BigNumber.from("10000000000"));
    expect(TokenValue.fromHuman("12.56", 6).mod(5)).toMatchTokenValue(6, "2.56", BigNumber.from("2560000"));
  });

  it("mulMod", () => {
    expect(TokenValue.fromHuman(3, 0).mulMod(4, 5)).toMatchTokenValue(0, "2", BigNumber.from("2"));
    expect(TokenValue.fromHuman(3.14, 6).mul(4)).toMatchTokenValue(6, "12.56", BigNumber.from("12560000"));
    expect(TokenValue.fromHuman(3.14, 6).mulMod(4, 5)).toMatchTokenValue(6, "2.56", BigNumber.from("2560000"));
  });

  // TODO: is this right?
  it("mulDiv", () => {
    expect(TokenValue.fromHuman(3.14, 6).mulDiv(10, 2)).toMatchTokenValue(6, "15.7", BigNumber.from("15700000"));
  });

  it("div", () => {
    expect(TokenValue.fromHuman("100.5", 0).div(2)).toMatchTokenValue(0, "50", BigNumber.from("50"));
    expect(TokenValue.fromHuman("100.5", 1).div(2)).toMatchTokenValue(1, "50.2", BigNumber.from("502"));
    expect(TokenValue.fromHuman("100.5", 2).div(2)).toMatchTokenValue(2, "50.25", BigNumber.from("5025"));
    expect(TokenValue.fromHuman("100.5", 3).div(2)).toMatchTokenValue(3, "50.25", BigNumber.from("50250"));

    // TODO: not intuitive that it give 7 decimals
    expect(TokenValue.fromHuman("100.5", 6).div(2.5)).toMatchTokenValue(7, "40.2", BigNumber.from("402000000"));
    // But we can override by passing a decimal param to .div()
    expect(TokenValue.fromHuman("100.5", 6).div(2.5, 6)).toMatchTokenValue(6, "40.2", BigNumber.from("40200000"));
  });

  it("eq", () => {
    const n1 = TokenValue.fromHuman("100", 6);

    expect(n1.eq(100)).toBe(true);
    // BigNumber assumes same decimal places as n1
    expect(n1.eq(BigNumber.from("100"))).toBe(true);
    expect(n1.eq(BigNumber.from("100000000"))).toBe(false);
    expect(n1.eq(TokenValue.fromHuman("100", 6))).toBe(true);
    expect(n1.eq(99)).toBe(false);
    expect(n1.eq(101)).toBe(false);

    expect(TokenValue.fromHuman("100", 2).eq(TokenValue.fromHuman("100", 2))).toBe(true);
    expect(TokenValue.fromHuman("100", 2).eq(TokenValue.fromHuman("100", 3))).toBe(true);
  });

  it("gt", () => {
    const n1 = TokenValue.fromHuman("100", 6);
    expect(n1.gt(99)).toBe(true);
    expect(n1.gt(TokenValue.fromHuman("99", 6))).toBe(true);
    expect(n1.gt(TokenValue.fromHuman("99.999999", 6))).toBe(true);
    expect(n1.gt(TokenValue.fromHuman("99.999999999999", 6))).toBe(true);
    expect(n1.gt(BigNumber.from(99))).toBe(true);
    expect(n1.gt(BigNumber.from(100))).toBe(false);
    expect(n1.gt(100)).toBe(false);
    expect(n1.gt(101)).toBe(false);
  });

  it("gte", () => {
    const n1 = TokenValue.fromHuman("100", 6);
    expect(n1.gte(99)).toBe(true);
    expect(n1.gte(100)).toBe(true);
    expect(n1.gte(101)).toBe(false);
  });

  it("lt", () => {
    const n1 = TokenValue.fromHuman("100", 6);
    expect(n1.lt(101)).toBe(true);
    expect(n1.lt(TokenValue.fromHuman("101", 6))).toBe(true);
    expect(n1.lt(TokenValue.fromHuman("100.111111", 6))).toBe(true);
    expect(n1.lt(TokenValue.fromHuman("100.111111111111111111", 6))).toBe(true);
    expect(n1.lt(TokenValue.fromHuman("100.11111111111111111111111111111", 6))).toBe(true);
    expect(n1.lt(BigNumber.from(100000001))).toBe(true);
    expect(n1.lt(BigNumber.from(100000000))).toBe(true);
    expect(n1.lt(BigNumber.from(101))).toBe(true);
    expect(n1.lt(BigNumber.from(100))).toBe(false);
    expect(n1.lt(100)).toBe(false);
    expect(n1.lt(101)).toBe(true);
  });

  it("lte", () => {
    const n1 = TokenValue.fromHuman("100", 6);
    expect(n1.lte(BigNumber.from(101))).toBe(true);
    expect(n1.lte(BigNumber.from(100))).toBe(true);
    expect(n1.lte(BigNumber.from(99))).toBe(false);
    expect(n1.lte(101)).toBe(true);
    expect(n1.lte(100)).toBe(true);
    expect(n1.lte(99)).toBe(false);
  });
  it("min", () => {
    const n1 = TokenValue.fromHuman("1", 6);
    const n2 = TokenValue.fromHuman("-1.5", 6);
    const n3 = TokenValue.fromHuman("2", 6);
    const n4 = TokenValue.fromHuman("3", 6);
    const n5 = TokenValue.fromHuman("1", 0);
    const n6 = TokenValue.fromHuman("0", 0);

    expect(TokenValue.min(n1, n2, n3, n4)).toMatchTokenValue(6, "-1.5");
    expect(TokenValue.min(n1, n5)).toMatchTokenValue(0, "1");
    expect(TokenValue.min(n5, n6)).toMatchTokenValue(0, "0");

    // same value but different decimals, both are equal, last one is returned
    expect(TokenValue.min(TokenValue.fromHuman(3.14, 7), TokenValue.fromHuman(3.14, 3))).toMatchTokenValue(3, "3.14");
    expect(TokenValue.min(TokenValue.fromHuman(3.14, 3), TokenValue.fromHuman(3.14, 7))).toMatchTokenValue(7, "3.14");
    expect(TokenValue.min(TokenValue.fromHuman(1, 1), TokenValue.fromHuman(1, 1))).toMatchTokenValue(1, "1");
    expect(TokenValue.min(TokenValue.fromHuman(1, 1))).toMatchTokenValue(1, "1");
  });
  it("max", () => {
    const n1 = TokenValue.fromHuman("1", 6);
    const n2 = TokenValue.fromHuman("-1.5", 6);
    const n3 = TokenValue.fromHuman("2", 6);
    const n4 = TokenValue.fromHuman("3", 6);
    const n5 = TokenValue.fromHuman("1", 0);
    const n6 = TokenValue.fromHuman("0", 0);

    expect(TokenValue.max(n1, n2, n3, n4)).toMatchTokenValue(6, "3");
    expect(TokenValue.max(n1, n4)).toMatchTokenValue(6, "3");
    expect(TokenValue.max(n4, n1)).toMatchTokenValue(6, "3");

    // to number with diff decimals, but equal bignumbers, will return based on order provided
    expect(TokenValue.max(n1, n5)).toMatchTokenValue(0, "1");
    expect(TokenValue.max(n5, n1)).toMatchTokenValue(6, "1");

    expect(TokenValue.max(n5, n6)).toMatchTokenValue(0, "1");
    expect(TokenValue.max(TokenValue.fromHuman(3.14, 7), TokenValue.fromHuman(3.14, 3))).toMatchTokenValue(3, "3.14");
    expect(TokenValue.max(TokenValue.fromHuman(1, 1), TokenValue.fromHuman(1, 1))).toMatchTokenValue(1, "1");
    expect(TokenValue.max(TokenValue.fromHuman(1, 1))).toMatchTokenValue(1, "1");
  });

  it("abs", () => {
    const n1 = TokenValue.fromHuman("123.45", 6);
    const n2 = TokenValue.fromHuman("-123.45", 6);
    expect(n1.abs()).toMatchTokenValue(6, "123.45", BigNumber.from("123450000"));
    expect(n2.abs()).toMatchTokenValue(6, "123.45", BigNumber.from("123450000"));
  });

  it("pow", () => {
    const n1 = TokenValue.fromHuman("5.3", 6);
    expect(TokenValue.fromHuman(5, 0).pow(2)).toMatchTokenValue(0, "25", BigNumber.from("25"));
    // TODO: Not intuitive.. is this right?
    expect(n1.pow(2)).toMatchTokenValue(12, "28.09", BigNumber.from("28090000000000"));
    expect(n1.pow(1)).toMatchTokenValue(6, "5.3", BigNumber.from("5300000"));
    expect(n1.pow(0)).toMatchTokenValue(0, "1", BigNumber.from("1"));
  });

  it("pct", () => {
    expect(TokenValue.fromHuman(100, 6).pct(5)).toMatchTokenValue(6, "5");
    expect(TokenValue.fromHuman(100, 6).pct(0.01)).toMatchTokenValue(6, "0.01");

    // TODO: why 2? Are we sure we want to default to 2
    expect(TokenValue.fromHuman(100, 0).pct(0.01)).toMatchTokenValue(2, "0.01");
    expect(TokenValue.fromHuman(100, 3).pct(0)).toMatchTokenValue(3, "0");
    expect(() => TokenValue.fromHuman(100, 3).pct(-1)).toThrow("Percent value must be bigger than 0");
    expect(TokenValue.fromHuman("3843.992712", 6).pct(0.9)).toMatchTokenValue(6, "34.595934");
    expect(TokenValue.fromHuman("3843.992712", 6).pct(3.5)).toMatchTokenValue(6, "134.539744");
    expect(TokenValue.fromHuman("3843.992712", 6).pct(3.123456789)).toMatchTokenValue(6, "120.065451");
    expect(TokenValue.fromHuman("3843.992712", 5).pct(3.123456789)).toMatchTokenValue(5, "120.06545");
    expect(TokenValue.fromHuman("3843.9927", 4).pct(3.123456789)).toMatchTokenValue(4, "120.0654");
    expect(TokenValue.fromHuman("3843.992", 3).pct(3.123456789)).toMatchTokenValue(3, "120.065");
    expect(TokenValue.fromHuman("3843.99", 2).pct(3.123456789)).toMatchTokenValue(2, "120.06");
    expect(TokenValue.fromHuman("3843.9", 1).pct(3.123456789)).toMatchTokenValue(2, "120.06");
    expect(TokenValue.fromHuman("3843", 1).pct(3.123456789)).toMatchTokenValue(2, "120.03");
  });
});

// Add custom Jest matcher
expect.extend({
  toMatchTokenValue(received: TokenValue, decimals: number, humanValue: string, bigNumber?: BigNumber) {
    if (decimals === undefined) throw new Error("Expected decimals to be a number");
    if (humanValue === undefined) throw new Error("Expected humanValue to be a string");
    if (bigNumber && !(bigNumber instanceof BigNumber)) throw new Error("Expected bigNumber to be a BigNumber");

    const decimalCheck = received.decimals === decimals;
    const humanCheck = received.toHuman() === humanValue;
    const bigNumberCheck = bigNumber ? received.toBigNumber().eq(bigNumber) : true;

    const match = decimalCheck && humanCheck && bigNumberCheck;

    if (match) {
      const msg = () =>
        bigNumber
          ? `Expected [${received.decimals}, ${received.toHuman()}, ${received
              .toBigNumber()
              .toString()}] not to equal [${decimals}, ${humanValue}, ${bigNumber.toString()}]`
          : `Expected [${received.decimals}, ${received.toHuman()}] not to equal [${decimals}, ${humanValue}}]`;

      return {
        pass: true,
        message: msg
      };
    } else {
      const msg = () =>
        bigNumber
          ? `Expected [${received.decimals}, ${received.toHuman()}, ${received
              .toBigNumber()
              .toString()}] to equal [${decimals}, ${humanValue}, ${bigNumber.toString()}]`
          : `Expected [${received.decimals}, ${received.toHuman()}] to equal [${decimals}, ${humanValue}]`;
      return {
        pass: false,
        message: msg
      };
    }
  }
});

declare module "expect" {
  interface AsymmetricMatchers {
    toMatchTokenValue(decimals: number, humanValue: string, bigNumber?: BigNumber): void;
  }
  interface Matchers<R> {
    toMatchTokenValue(decimals: number, humanValue: string, bigNumber?: BigNumber): R;
  }
}
