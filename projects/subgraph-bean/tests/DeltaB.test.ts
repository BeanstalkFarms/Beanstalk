import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as/assembly/log";
import { handleMetapoolOracle, handleWellOracle } from "../src/BeanstalkHandler";
import { ONE_BI } from "../../subgraph-core/utils/Decimals";
import { createMetapoolOracleEvent, createWellOracleEvent } from "./event-mocking/Beanstalk";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";
import { hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";

const timestamp1 = BigInt.fromU32(1712793374);
const hour1 = hourFromTimestamp(timestamp1).toString();
const block1 = mockBlock(BigInt.fromU32(18000000), timestamp1);
const timestamp2 = BigInt.fromU32(1713220949);
const hour2 = hourFromTimestamp(timestamp1).toString();

describe("Oracle: DeltaB", () => {
  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  describe("TWA DeltaB", () => {
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
