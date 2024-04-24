import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { BigInt, Bytes, BigDecimal, log } from "@graphprotocol/graph-ts";
// import { log } from "matchstick-as/assembly/log";
import { handleMetapoolOracle, handleWellOracle } from "../src/BeanstalkHandler";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { createMetapoolOracleEvent, createWellOracleEvent } from "./event-mocking/Beanstalk";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, CRV3_POOL } from "../../subgraph-core/utils/Constants";
import { hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { uniswapV2DeltaB } from "../src/utils/price/UniswapPrice";
import { decodeCumulativeWellReserves } from "../src/utils/price/WellPrice";
import { mock_virtual_price } from "./event-mocking/Curve";
import { loadOrCreatePool } from "../src/utils/Pool";
import { loadBean } from "../src/utils/Bean";
import { getD, getY, priceFromY } from "../src/utils/price/CurvePrice";
import { Bytes_bigEndian } from "../../subgraph-core/utils/BigEndian";
import { ABDK_toUInt, pow2toX } from "../../subgraph-core/utils/ABDKMathQuad";

const timestamp1 = BigInt.fromU32(1712793374);
const hour1 = hourFromTimestamp(timestamp1).toString();
const block1 = mockBlock(BigInt.fromU32(18000000), timestamp1);
const timestamp2 = BigInt.fromU32(1713220949);
const hour2 = hourFromTimestamp(timestamp1).toString();

describe("DeltaB", () => {
  beforeAll(() => {
    // Vprice set to 1 for simplicity
    mock_virtual_price(CRV3_POOL, BigInt.fromString("1000000000000000000"));
    mock_virtual_price(BEAN_3CRV, BigInt.fromString("1000000000000000000"));
  });

  afterEach(() => {
    // log.debug("clearing the store", []);
    clearStore();
  });

  describe("Calculations", () => {
    test("UniswapV2 DeltaB", () => {
      // inst
      const beans = BigDecimal.fromString("100631.374814");
      const weth = BigDecimal.fromString("32.362727191355245180");
      const wethPrice = BigDecimal.fromString("3156.89212676");
      const deltaB = uniswapV2DeltaB(beans, weth, wethPrice);
      assert.bigIntEquals(BigInt.fromString("764230012"), deltaB);

      // twa
      const reserves = [BigInt.fromString("453302737605276409780"), BigInt.fromString("1844890989703")];
      const prices = [BigInt.fromString("245707004435700"), BigInt.fromString("245207214122420")];
      const mulReserves = reserves[0].times(reserves[1]).times(BI_10.pow(6));
      const currentBeans = mulReserves.div(prices[0]).sqrt();
      const targetBeans = mulReserves.div(prices[1]).sqrt();
      const twaDeltaB = targetBeans.minus(currentBeans);
      assert.bigIntEquals(BigInt.fromString("1879205277"), twaDeltaB);
    });

    test("Curve Price", () => {
      // Bean3crv_v1 pool at block 14441689

      const other_virtual_price = BigInt.fromString("1020543257852678845");
      const xp = [
        BigInt.fromString("3503110156477").times(BI_10.pow(12)),
        BigInt.fromString("3441135481866150809775262").times(other_virtual_price).div(BI_10.pow(18))
      ];

      const D = getD(xp, BigInt.fromU32(1000));
      const y = getY(xp[0].plus(BI_10.pow(12)), xp, BigInt.fromU32(1000), D);
      const price = priceFromY(y, xp[1]);

      // log.debug("xp[1] {}", [xp[1].toString()]);

      assert.stringEquals("1.000225971464", price.toString());
    });

    test("Well Reserves", () => {
      const s21076: Bytes = Bytes.fromHexString(
        "0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401ca3e863ef477b955382fabeb6239e00000000000000000000000000000000401d61893f2d4f8972713291748d66f700000000000000000000000000000000"
      );
      const s21077: Bytes = Bytes.fromHexString(
        "0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401ca3fba9f61fac686ea2125d43bc8800000000000000000000000000000000401d61990e063036b2da05122259d76c00000000000000000000000000000000"
      );
      const result1 = decodeCumulativeWellReserves(s21076);
      const result2 = decodeCumulativeWellReserves(s21077);

      const asUInt1 = [ABDK_toUInt(result1[0]), ABDK_toUInt(result1[1])];
      const asUInt2 = [ABDK_toUInt(result2[0]), ABDK_toUInt(result2[1])];

      const elapsedTime = BigDecimal.fromString("3600");
      const diff0 = new BigDecimal(asUInt2[0].minus(asUInt1[0])).div(elapsedTime);
      const diff1 = new BigDecimal(asUInt2[1].minus(asUInt1[1])).div(elapsedTime);

      log.debug("Well Reserves", []);
      // log.debug("Converted result {} {}", [asUInt1[0].toString(), asUInt1[1].toString()]);
      // log.debug("Converted result {} {}", [asUInt2[0].toString(), asUInt2[1].toString()]);
      // log.debug("Differences {} {}", [diff0.toString(), diff1.toString()]);
      log.debug("TWA Reserves {} {}", [pow2toX(diff0).toString(), pow2toX(diff1).toString()]);
    });
  });

  describe("Oracle: TWA Reserves", () => {
    test("MetapoolOracle", () => {
      const t1 = BigInt.fromU32(1712000000);
      const t2 = BigInt.fromU32(1712003600);
      const t3 = BigInt.fromU32(1712007200);
      const b1 = mockBlock(BigInt.fromU32(18000000), t1);
      const b2 = mockBlock(BigInt.fromU32(18000300), t2);
      const b3 = mockBlock(BigInt.fromU32(18000600), t3);
      const prefixCurve = BEAN_3CRV.toHexString() + "-";
      const h1 = hourFromTimestamp(t1).toString();
      const h2 = hourFromTimestamp(t2).toString();
      const h3 = hourFromTimestamp(t3).toString();
      // 100, 110
      const reserves1 = [BigInt.fromString("100000000"), BigInt.fromString("100000000000000000000")];
      // 200, 210
      const reserves2 = [BigInt.fromString("300000000"), BigInt.fromString("310000000000000000000")];
      // 200, 200
      const reserves3 = [BigInt.fromString("500000000"), BigInt.fromString("510000000000000000000")];

      // Set liquidity so weighted twa prices can be set
      let pool = loadOrCreatePool(BEAN_3CRV.toHexString(), b2.number);
      pool.liquidityUSD = BigDecimal.fromString("10000");
      pool.save();
      let bean = loadBean(BEAN_ERC20.toHexString());
      bean.liquidityUSD = BigDecimal.fromString("10000");
      bean.save();

      // Initialize oracle
      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, ZERO_BI, reserves1, b1));
      assert.fieldEquals("TwaOracle", BEAN_3CRV.toHexString(), "priceCumulativeLast", "[100000000, 100000000000000000000]");
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h1, "twaDeltaBeans", "0");
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h1, "twaPrice", "0.9999995");
      assert.fieldEquals("BeanHourlySnapshot", BEAN_ERC20.toHexString() + "-6074", "twaDeltaB", "0");

      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, ZERO_BI, reserves2, b2));
      assert.fieldEquals("TwaOracle", BEAN_3CRV.toHexString(), "priceCumulativeLast", "[300000000, 310000000000000000000]");
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h2, "twaDeltaBeans", "1380"); // TODO: check this, seems small
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h2, "twaPrice", "1.02469666391");
      assert.fieldEquals("BeanHourlySnapshot", BEAN_ERC20.toHexString() + "-6074", "twaPrice", "1.02469666391");

      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, ZERO_BI, reserves3, b3));
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h3, "twaDeltaBeans", "0");
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + h3, "twaPrice", "0.999996000005");
    });

    test("WellOracle", () => {
      // 2 consecutive seasons used for test
      // https://etherscan.io/tx/0xe62ebdb74a9908760f709408944ab2d50f0bc4fd95614a05dcc053a7117e6b33#eventlog
      handleWellOracle(
        createWellOracleEvent(
          BigInt.fromI32(21076),
          "0xbea0e11282e2bb5893bece110cf199501e872bad",
          ZERO_BI,
          Bytes.fromHexString(
            "0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401ca3e863ef477b955382fabeb6239e00000000000000000000000000000000401d61893f2d4f8972713291748d66f700000000000000000000000000000000"
          )
        )
      );
      // https://etherscan.io/tx/0x0b872f5503d732f3c9f736e914368791ab3c8da8d9fcd87f071574f0e9b7ca6f#eventlog
      handleWellOracle(
        createWellOracleEvent(
          BigInt.fromI32(21077),
          "0xbea0e11282e2bb5893bece110cf199501e872bad",
          ZERO_BI,
          Bytes.fromHexString(
            "0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401ca3fba9f61fac686ea2125d43bc8800000000000000000000000000000000401d61990e063036b2da05122259d76c00000000000000000000000000000000"
          )
        )
      );
    });
  });
});
