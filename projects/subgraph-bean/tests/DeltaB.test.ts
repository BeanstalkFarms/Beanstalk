import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { BigInt, Bytes, BigDecimal } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as/assembly/log";
import { handleMetapoolOracle, handleWellOracle } from "../src/BeanstalkHandler";
import { BI_10, ONE_BI } from "../../subgraph-core/utils/Decimals";
import { createMetapoolOracleEvent, createWellOracleEvent } from "./event-mocking/Beanstalk";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";
import { hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { uniswapV2DeltaB } from "../src/utils/price/UniswapPrice";
import { decodeCumulativeWellReserves } from "../src/utils/price/WellReserves";

const timestamp1 = BigInt.fromU32(1712793374);
const hour1 = hourFromTimestamp(timestamp1).toString();
const block1 = mockBlock(BigInt.fromU32(18000000), timestamp1);
const timestamp2 = BigInt.fromU32(1713220949);
const hour2 = hourFromTimestamp(timestamp1).toString();

describe("DeltaB", () => {
  afterEach(() => {
    log.debug("clearing the store", []);
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

    test("Well Reserves", () => {
      const s20957: Bytes = Bytes.fromHexString(
        "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401c9af3e734ec6d928f0c9ca6742af600000000000000000000000000000000401d5a2f51848f06f7a8f4a88134162d00000000000000000000000000000000"
      );
      const s20958: Bytes = Bytes.fromHexString(
        "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002401c9b072d77cfcb46ba839751eec22000000000000000000000000000000000401d5a3f22dfd1d71d115e69bb6a8ca800000000000000000000000000000000"
      );
      const result1 = decodeCumulativeWellReserves(s20957);
      const result2 = decodeCumulativeWellReserves(s20958);
      log.debug("Well Reserves", []);
      log.debug("Decode result {} {}", [result1[0].toString(), result1[1].toString()]);
      log.debug("Decode result {} {}", [result2[0].toString(), result2[1].toString()]);
      log.debug("Differences {} {}", [result2[0].minus(result1[0]).toString(), result2[1].minus(result1[1]).toString()]);
    });
  });

  describe("Oracle: TWA DeltaB", () => {
    test("Post-Replant Curve", () => {
      let deltaB = BigInt.fromU32(100);
      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, deltaB, [ONE_BI, ONE_BI], block1));
      const poolPrefix = BEAN_3CRV.toHexString() + "-";
      assert.fieldEquals("PoolHourlySnapshot", poolPrefix + hour1, "twaDeltaBeans", deltaB.toString());
      assert.fieldEquals("BeanHourlySnapshot", BEAN_ERC20.toHexString() + "-6074", "twaDeltaB", deltaB.toString());
    });

    test("Post-Replant Well", () => {
      let deltaB = BigInt.fromI32(-2500);
      handleWellOracle(createWellOracleEvent(ONE_BI, BEAN_WETH_CP2_WELL.toHexString(), deltaB, Bytes.fromHexString("0x00"), block1));
      const poolPrefix = BEAN_WETH_CP2_WELL.toHexString() + "-";
      assert.fieldEquals("PoolHourlySnapshot", poolPrefix + hour1, "twaDeltaBeans", deltaB.toString());
      assert.fieldEquals("BeanHourlySnapshot", BEAN_ERC20.toHexString() + "-6074", "twaDeltaB", deltaB.toString());
    });

    test("Post-Replant Cumulative", () => {
      let curve = BigInt.fromI32(-150);
      let well = BigInt.fromU32(600);
      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, curve, [ONE_BI, ONE_BI], block1));
      handleWellOracle(createWellOracleEvent(ONE_BI, BEAN_WETH_CP2_WELL.toHexString(), well, Bytes.fromHexString("0x00"), block1));
      const prefixCurve = BEAN_3CRV.toHexString() + "-";
      const prefixWell = BEAN_WETH_CP2_WELL.toHexString() + "-";
      assert.fieldEquals("PoolHourlySnapshot", prefixCurve + hour1, "twaDeltaBeans", curve.toString());
      assert.fieldEquals("PoolHourlySnapshot", prefixWell + hour1, "twaDeltaBeans", well.toString());
      assert.fieldEquals("BeanHourlySnapshot", BEAN_ERC20.toHexString() + "-6074", "twaDeltaB", curve.plus(well).toString());
    });
  });
});
