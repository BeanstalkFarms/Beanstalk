import { beforeEach, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";

import { BigDecimal } from "@graphprotocol/graph-ts";

import { handleBlock } from "../src/BlockHandler";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { mockPreReplantBeanEthPrice, mockPreReplantETHPrice, simpleMockPrice } from "../../subgraph-core/tests/event-mocking/Price";

import {
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_CP2_WELL_BLOCK,
  BEAN_WETH_V1,
  BEANSTALK_BLOCK
} from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD } from "../../subgraph-core/utils/Decimals";

import { loadBean } from "../src/utils/Bean";
import { calcUniswapV2Inst, getPreReplantPriceETH, constantProductPrice, uniswapV2Reserves } from "../src/utils/price/UniswapPrice";

const wellCrossId = (n: u32): string => {
  return BEAN_WETH_CP2_WELL.toHexString() + "-" + n.toString();
};

const univ2CrossId = (n: u32): string => {
  return BEAN_WETH_V1.toHexString() + "-" + n.toString();
};

describe("Peg Crosses", () => {
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

  describe("UniswapV2", () => {
    test("Can Set ETH and BEAN Price", () => {
      const ethPrice = BigDecimal.fromString("3500");
      mockPreReplantETHPrice(ethPrice);
      assert.assertTrue(getPreReplantPriceETH().equals(ethPrice));

      const beanPrice = BigDecimal.fromString("1.6057");
      mockPreReplantBeanEthPrice(beanPrice);

      const reserves = uniswapV2Reserves(BEAN_WETH_V1);
      const ethPriceNow = getPreReplantPriceETH();
      const newPrice = constantProductPrice(toDecimal(reserves[0]), toDecimal(reserves[1], 18), ethPriceNow);
      log.info("expected | actual {} | {}", [beanPrice.toString(), newPrice.truncate(4).toString()]);
      assert.assertTrue(beanPrice.equals(newPrice));

      const beanPrice2 = BigDecimal.fromString("0.7652");
      mockPreReplantBeanEthPrice(beanPrice2);

      const reserves2 = uniswapV2Reserves(BEAN_WETH_V1);
      const ethPriceNow2 = getPreReplantPriceETH();
      const newPrice2 = constantProductPrice(toDecimal(reserves2[0]), toDecimal(reserves2[1], 18), ethPriceNow2);
      log.info("expected | actual {} | {}", [beanPrice2.toString(), newPrice2.truncate(4).toString()]);
      assert.assertTrue(beanPrice2.equals(newPrice2));
    });

    // TODO: include bean cross here once implemented
    test("UniswapV2 cross above", () => {
      mockPreReplantBeanEthPrice(BigDecimal.fromString("0.99"));
      handleBlock(mockBlock(BEANSTALK_BLOCK));

      // assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", univ2CrossId(0));

      mockPreReplantBeanEthPrice(BigDecimal.fromString("1.01"));
      handleBlock(mockBlock(BEANSTALK_BLOCK));

      // assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");
    });

    test("UniswapV2 cross below", () => {
      mockPreReplantBeanEthPrice(BigDecimal.fromString("1.25"));
      handleBlock(mockBlock(BEANSTALK_BLOCK));

      // assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");

      mockPreReplantBeanEthPrice(BigDecimal.fromString("0.8"));
      handleBlock(mockBlock(BEANSTALK_BLOCK));

      // assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.fieldEquals("PoolCross", univ2CrossId(1), "above", "false");
    });
  });

  describe("BEAN:ETH Well", () => {
    test("Well/Bean cross above", () => {
      simpleMockPrice(0.99, 0.99);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", wellCrossId(0));

      simpleMockPrice(1.01, 1.01);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");
    });

    test("Well/Bean cross below", () => {
      simpleMockPrice(1.25, 1.25);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(0.8, 0.8);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");
    });

    test("Well/Bean cross above (separately)", () => {
      simpleMockPrice(0.95, 0.99);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", wellCrossId(0));

      simpleMockPrice(0.98, 1.02);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(1.02, 1.07);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.notInStore("PoolCross", wellCrossId(1));
    });

    test("Well/Bean cross below (separately)", () => {
      simpleMockPrice(1.05, 1.01);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(1.02, 0.98);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.notInStore("BeanCross", "1");
      assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");

      simpleMockPrice(0.97, 0.92);
      handleBlock(mockBlock(BEAN_WETH_CP2_WELL_BLOCK));

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.notInStore("BeanCross", wellCrossId(2));
    });
  });
});
