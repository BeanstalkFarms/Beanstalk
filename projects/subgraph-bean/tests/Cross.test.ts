import { beforeEach, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";

import { handleBlock } from "../src/BlockHandler";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { simpleMockPrice } from "../../subgraph-core/tests/event-mocking/Price";

import { BEAN_ERC20, BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";
import { ZERO_BD } from "../../subgraph-core/utils/Decimals";

import { loadBean } from "../src/utils/Bean";

const wellCrossId = (n: u32): string => {
  return BEAN_WETH_CP2_WELL.toHexString() + "-" + n.toString();
};

describe("Well: Crosses", () => {
  beforeEach(() => {
    // Bean price is init at 1.07, set to 0 so it is consistent will Well starting price
    let bean = loadBean(BEAN_ERC20.toHexString());
    bean.price = ZERO_BD;
    bean.save();

    // Should begin with zero crosses
    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", "0");
  });

  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  test("Well/Bean cross above", () => {
    simpleMockPrice(0.99, 0.99);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", wellCrossId(0));

    simpleMockPrice(1.01, 1.01);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");
  });

  test("Well/Bean cross below", () => {
    simpleMockPrice(1.25, 1.25);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    simpleMockPrice(0.8, 0.8);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "1", "above", "false");
    assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");
  });

  test("Well/Bean cross above (separately)", () => {
    simpleMockPrice(0.95, 0.99);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", wellCrossId(0));

    simpleMockPrice(0.98, 1.02);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    simpleMockPrice(1.02, 1.07);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.notInStore("PoolCross", wellCrossId(1));
  });

  test("Well/Bean cross below (separately)", () => {
    simpleMockPrice(1.05, 1.01);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    simpleMockPrice(1.02, 0.98);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "1");
    assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");

    simpleMockPrice(0.97, 0.92);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "1", "above", "false");
    assert.notInStore("BeanCross", wellCrossId(2));
  });
});
