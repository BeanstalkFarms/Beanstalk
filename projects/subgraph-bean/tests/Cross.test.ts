import { beforeEach, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";

import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { handleBlock } from "../src/BlockHandler";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { mockPreReplantETHPrice, simpleMockPrice } from "../../subgraph-core/tests/event-mocking/Price";

import { BEAN_3CRV_V1, BEAN_ERC20, BEAN_ERC20_V1, BEAN_WETH_CP2_WELL, BEAN_WETH_V1 } from "../../subgraph-core/utils/Constants";
import { BD_10, ONE_BD, ONE_BI, toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";

import { loadBean } from "../src/utils/Bean";
import { getPreReplantPriceETH, constantProductPrice, uniswapV2Reserves } from "../src/utils/price/UniswapPrice";
import { mockPoolPriceAndLiquidity, mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves } from "./entity-mocking/MockPool";
import { updatePricesAndCheckCrosses as crv_updatePricesAndCheckCrosses } from "../src/Bean3CRVHandler_V1";
import { setWhitelistedPools } from "./entity-mocking/MockBean";
import { PEG_CROSS_BLOCKS } from "../src/result_cache/PegCrossBlocks";
import { u32_binarySearchIndex } from "../../subgraph-core/utils/Math";

const wellCrossId = (n: u32): string => {
  return BEAN_WETH_CP2_WELL.toHexString() + "-" + n.toString();
};

const univ2CrossId = (n: u32): string => {
  return BEAN_WETH_V1.toHexString() + "-" + n.toString();
};

const crvV1CrossId = (n: u32): string => {
  return BEAN_3CRV_V1.toHexString() + "-" + n.toString();
};

const UNIV2_CROSS_BLOCK = BigInt.fromU32(12984310);
const WELL_CROSS_BLOCK = BigInt.fromU32(18965881);

describe("Peg Crosses", () => {
  beforeEach(() => {
    // Bean price is init at 1.07, set to 0 so it is consistent will pool starting price
    let bean = loadBean(BEAN_ERC20.toHexString());
    bean.price = ZERO_BD;
    bean.save();

    let beanv1 = loadBean(BEAN_ERC20_V1.toHexString());
    beanv1.price = ZERO_BD;
    beanv1.save();

    // Should begin with zero crosses
    assert.notInStore("BeanCross", "0");
    assert.notInStore("PoolCross", "0");
  });

  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  describe("Cache", () => {
    test("PEG_CROSS_BLOCKS", () => {
      const notFound = u32_binarySearchIndex(PEG_CROSS_BLOCKS, 14934659);
      const found = u32_binarySearchIndex(PEG_CROSS_BLOCKS, 19252859);
      assert.assertTrue(notFound == -1);
      assert.assertTrue(found != -1);
    });
  });

  describe("UniswapV2", () => {
    test("Can Set ETH and BEAN Price and Pool Liquidity", () => {
      const ethPrice = BigDecimal.fromString("3500");
      mockPreReplantETHPrice(ethPrice);
      assert.assertTrue(getPreReplantPriceETH().equals(ethPrice));

      const beanPrice = BigDecimal.fromString("1.6057");
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(beanPrice);

      const reserves = uniswapV2Reserves(BEAN_WETH_V1);
      const ethPriceNow = getPreReplantPriceETH();
      const newPrice = constantProductPrice(toDecimal(reserves[1]), toDecimal(reserves[0], 18), ethPriceNow);
      log.info("expected | actual {} | {}", [beanPrice.toString(), newPrice.truncate(4).toString()]);
      assert.assertTrue(beanPrice.equals(newPrice));

      const beanPrice2 = BigDecimal.fromString("0.7652");
      const liquidity2 = BigDecimal.fromString("1234567");
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(beanPrice2, liquidity2);

      const reserves2 = uniswapV2Reserves(BEAN_WETH_V1);
      const ethPriceNow2 = getPreReplantPriceETH();
      const newPrice2 = constantProductPrice(toDecimal(reserves2[1]), toDecimal(reserves2[0], 18), ethPriceNow2);
      const newLiquidity2 = toDecimal(reserves2[0], 18).times(ethPriceNow2).times(BigDecimal.fromString("2"));
      log.info("expected | actual {} | {}", [beanPrice2.toString(), newPrice2.truncate(4).toString()]);
      assert.assertTrue(beanPrice2.equals(newPrice2));
      log.info("expected | actual {} | {}", [liquidity2.truncate(0).toString(), newLiquidity2.truncate(0).toString()]);
      // assert.assertTrue(liquidity2.truncate(0).equals(newLiquidity2.truncate(0)));
    });

    test("UniswapV2/Bean cross above", () => {
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.99"));
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", univ2CrossId(0));

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("1.01"));
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");
    });

    test("UniswapV2/Bean cross below", () => {
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("1.25"));
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.8"));
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.fieldEquals("PoolCross", univ2CrossId(1), "above", "false");
    });

    test("UniswapV2/Bean cross above (separately)", () => {
      const liquidity = BigDecimal.fromString("5000000");
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.95"), liquidity);
      mockPoolPriceAndLiquidity(BEAN_3CRV_V1, BigDecimal.fromString("0.99"), liquidity, UNIV2_CROSS_BLOCK);
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", univ2CrossId(0));
      assert.notInStore("PoolCross", crvV1CrossId(0));

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("1.02"), liquidity);
      mockPoolPriceAndLiquidity(BEAN_3CRV_V1, BigDecimal.fromString("0.9"), liquidity, UNIV2_CROSS_BLOCK);
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");
      assert.notInStore("PoolCross", crvV1CrossId(0));

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("1.06"), liquidity);
      // Requires a curve swap to update since the uniswap pool already crossed. Swap content is irrelevant
      // This doesnt perform the full swap logic but is sufficient
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        BigDecimal.fromString("0.95"),
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.notInStore("PoolCross", univ2CrossId(1));
      assert.notInStore("PoolCross", crvV1CrossId(0));
      assert.fieldEquals("Pool", BEAN_WETH_V1.toHexString(), "lastPrice", "1.06000000000033071999957610318464");
    });

    test("UniswapV2/Bean cross below (separately)", () => {
      const liquidity = BigDecimal.fromString("5000000");
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("1.05"), liquidity);
      // mockPoolPriceAndLiquidity(BEAN_3CRV_V1, BigDecimal.fromString("1.01"), liquidity, UNIV2_CROSS_BLOCK);
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        BigDecimal.fromString("1.01"),
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", univ2CrossId(0), "above", "true");
      assert.fieldEquals("PoolCross", crvV1CrossId(0), "above", "true");

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.97"), liquidity);
      mockPoolPriceAndLiquidity(BEAN_3CRV_V1, BigDecimal.fromString("1.05"), liquidity, UNIV2_CROSS_BLOCK);
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.notInStore("BeanCross", "1");
      assert.fieldEquals("PoolCross", univ2CrossId(1), "above", "false");
      assert.notInStore("PoolCross", crvV1CrossId(1));

      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.92"), liquidity);
      // Requires a curve swap to update since the uniswap pool already crossed. Swap content is irrelevant
      // This doesnt perform the full swap logic but is sufficient
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        BigDecimal.fromString("1.04"),
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.notInStore("PoolCross", univ2CrossId(2));
      assert.notInStore("PoolCross", crvV1CrossId(1));
      assert.fieldEquals("Pool", BEAN_WETH_V1.toHexString(), "lastPrice", "0.9200000000002796799996320850227199");
    });

    test("Bean cross from Liquidity change", () => {
      const liquidity = BigDecimal.fromString("5000000");
      const crvConstantPrice = BigDecimal.fromString("1.01");
      const crvLiquidity2 = liquidity.times(BD_10);
      mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(BigDecimal.fromString("0.95"), liquidity);
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        crvConstantPrice,
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );
      handleBlock(mockBlock(UNIV2_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", univ2CrossId(0));
      assert.fieldEquals("PoolCross", crvV1CrossId(0), "above", "true");

      mockPoolPriceAndLiquidity(BEAN_3CRV_V1, crvConstantPrice, crvLiquidity2, UNIV2_CROSS_BLOCK);
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        crvConstantPrice,
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.notInStore("PoolCross", univ2CrossId(0));
      assert.notInStore("PoolCross", crvV1CrossId(1));

      mockPoolPriceAndLiquidity(BEAN_3CRV_V1, crvConstantPrice, liquidity, UNIV2_CROSS_BLOCK);
      crv_updatePricesAndCheckCrosses(
        BEAN_3CRV_V1.toHexString(),
        crvConstantPrice,
        ONE_BI,
        ONE_BD,
        ONE_BD,
        ZERO_BI,
        ZERO_BI,
        UNIV2_CROSS_BLOCK
      );

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.notInStore("PoolCross", univ2CrossId(0));
      assert.notInStore("PoolCross", crvV1CrossId(1));
    });
  });

  describe("BEAN:ETH Well", () => {
    beforeEach(() => {
      setWhitelistedPools([BEAN_WETH_CP2_WELL.toHexString()]);
    });

    test("Well/Bean cross above", () => {
      simpleMockPrice(0.99, 0.99);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", wellCrossId(0));

      simpleMockPrice(1.01, 1.01);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");
    });

    test("Well/Bean cross below", () => {
      simpleMockPrice(1.25, 1.25);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(0.8, 0.8);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");
    });

    test("Well/Bean cross above (separately)", () => {
      simpleMockPrice(0.95, 0.99);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.notInStore("PoolCross", wellCrossId(0));

      simpleMockPrice(0.98, 1.02);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.notInStore("BeanCross", "0");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(1.02, 1.07);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.notInStore("PoolCross", wellCrossId(1));
    });

    test("Well/Bean cross below (separately)", () => {
      simpleMockPrice(1.05, 1.01);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "0", "above", "true");
      assert.fieldEquals("PoolCross", wellCrossId(0), "above", "true");

      simpleMockPrice(1.02, 0.98);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.notInStore("BeanCross", "1");
      assert.fieldEquals("PoolCross", wellCrossId(1), "above", "false");

      simpleMockPrice(0.97, 0.92);
      handleBlock(mockBlock(WELL_CROSS_BLOCK));

      assert.fieldEquals("BeanCross", "1", "above", "false");
      assert.notInStore("PoolCross", wellCrossId(2));
    });
  });
});
