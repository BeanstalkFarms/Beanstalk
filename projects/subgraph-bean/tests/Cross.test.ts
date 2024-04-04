import { beforeEach, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { BigInt } from "@graphprotocol/graph-ts";

import { handleBlock } from "../src/BeanWellHandler";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { setMockBeanPrice } from "../../subgraph-core/tests/event-mocking/Price";

import { BEAN_ERC20, BEAN_3CRV, BEAN_WETH_CP2_WELL, WETH, CRV3_POOL_V1 } from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";

import { loadBean } from "../src/utils/Bean";

const price = (p: number): BigInt => BigInt.fromU32(<u32>(p * Math.pow(10, 6)));

const mockPrice = (overall: number, beanEth: number): void => {
  setMockBeanPrice({
    price: price(overall),
    liquidity: BigInt.zero(),
    deltaB: BigInt.zero(),
    ps: [
      {
        contract: BEAN_WETH_CP2_WELL,
        tokens: [BEAN_ERC20, WETH],
        balances: [ZERO_BI, ZERO_BI],
        price: price(beanEth),
        liquidity: ZERO_BI,
        deltaB: ZERO_BI,
        lpUsd: ZERO_BI,
        lpBdv: ZERO_BI
      }
    ]
  });
};

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
    mockPrice(0.99, 0.99);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", wellCrossId(0));

    mockPrice(1.01, 1.01);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");
  });

  test("Well/Bean cross below", () => {
    mockPrice(1.25, 1.25);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    mockPrice(0.8, 0.8);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "1", "above", "false");
    assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");
  });

  test("Well/Bean cross above (separately)", () => {
    mockPrice(0.95, 0.99);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", wellCrossId(0));

    mockPrice(0.98, 1.02);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "0");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    mockPrice(1.02, 1.07);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.notInStore("PoolCross", wellCrossId(1));
  });

  test("Well/Bean cross below (separately)", () => {
    mockPrice(1.05, 1.01);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "0", "above", "true");
    assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

    mockPrice(1.02, 0.98);
    handleBlock(mockBlock());

    assert.notInStore("BeanCross", "1");
    assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");

    mockPrice(0.97, 0.92);
    handleBlock(mockBlock());

    assert.fieldEquals("BeanCross", "1", "above", "false");
    assert.notInStore("BeanCross", wellCrossId(2));
  });
});
