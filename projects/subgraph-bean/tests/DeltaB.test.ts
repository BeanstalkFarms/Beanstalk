import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as/assembly/log";
import { handleMetapoolOracle, handleWellOracle } from "../src/BeanstalkHandler";
import { ONE_BI } from "../../subgraph-core/utils/Decimals";
import { createMetapoolOracleEvent, createWellOracleEvent } from "./event-mocking/Beanstalk";
import { BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";

describe("Oracle: DeltaB", () => {
  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  describe("TWA DeltaB", () => {
    test("Post-Replant Curve", () => {
      const initial = BigInt.fromU32(100);
      handleMetapoolOracle(createMetapoolOracleEvent(ONE_BI, initial, [ONE_BI, ONE_BI]));
    });

    test("Post-Replant Well", () => {
      const initial = BigInt.fromU32(100);
      handleWellOracle(createWellOracleEvent(ONE_BI, BEAN_WETH_CP2_WELL.toHexString(), initial, Bytes.fromHexString("0x00")));
    });
  });
});
