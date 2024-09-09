import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test, log } from "matchstick-as/assembly/index";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEANSTALK_PRICE_2,
  CRV3_TOKEN,
  PRICE_1_BLOCK,
  PRICE_2_BLOCK,
  WETH
} from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { createDewhitelistTokenEvent } from "./event-mocking/Beanstalk";
import { setMockBeanPrice } from "../../subgraph-core/tests/event-mocking/Price";
import { BigInt } from "@graphprotocol/graph-ts";
import { BI_10 } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice_try_price, getPoolPrice } from "../src/utils/price/BeanstalkPrice";
import { loadBean } from "../src/entities/Bean";
import { handleDewhitelistToken } from "../src/handlers/BeanstalkHandler";
import { initL1Version } from "./entity-mocking/MockVersion";

const curvePrice = BigInt.fromU32(1012000);
const beanEthPrice = BigInt.fromU32(1025000);
const overallPrice = BigInt.fromU32(1022833);
const curveLiquidity = BigInt.fromU32(1000000).times(BI_10.pow(6));
const beanEthLiquidity = BigInt.fromU32(5000000).times(BI_10.pow(6));
const curveDelta = BigInt.fromI32(500).times(BI_10.pow(6));
const beanEthDelta = BigInt.fromI32(7500).times(BI_10.pow(6));
const contract2Price = BigInt.fromU32(1522833);

describe("BeanstalkPrice", () => {
  beforeAll(() => {
    setMockBeanPrice({
      price: overallPrice,
      liquidity: beanEthLiquidity.plus(curveLiquidity),
      deltaB: curveDelta.plus(beanEthDelta),
      ps: [
        {
          contract: BEAN_3CRV,
          tokens: [BEAN_ERC20, CRV3_TOKEN],
          balances: [BigInt.fromString("10"), BigInt.fromString("10")],
          price: curvePrice,
          liquidity: curveLiquidity,
          deltaB: curveDelta,
          lpUsd: BigInt.fromString("10"),
          lpBdv: BigInt.fromString("10")
        },
        {
          contract: BEAN_WETH_CP2_WELL,
          tokens: [BEAN_ERC20, WETH],
          balances: [BigInt.fromString("10"), BigInt.fromString("10")],
          price: beanEthPrice,
          liquidity: beanEthLiquidity,
          deltaB: beanEthDelta,
          lpUsd: BigInt.fromString("10"),
          lpBdv: BigInt.fromString("10")
        }
      ]
    });

    setMockBeanPrice(
      {
        price: contract2Price,
        liquidity: beanEthLiquidity.plus(curveLiquidity),
        deltaB: curveDelta.plus(beanEthDelta),
        ps: []
      },
      BEANSTALK_PRICE_2
    );
  });

  beforeEach(() => {
    initL1Version();

    let bean = loadBean(BEAN_ERC20);
    bean.pools = [BEAN_3CRV, BEAN_WETH_CP2_WELL];
    bean.save();
  });

  afterEach(() => {
    // log.debug("clearing the store", []);
    clearStore();
  });

  test("Can set the price", () => {
    const priceResult = BeanstalkPrice_try_price(PRICE_1_BLOCK);
    assert.assertTrue(priceResult.value.price.equals(overallPrice));
    assert.assertTrue(priceResult.value.ps.length == 2);
    assert.assertTrue(priceResult.dewhitelistedPools.length == 0);
  });

  test("Extract pool price", () => {
    const priceResult = BeanstalkPrice_try_price(PRICE_1_BLOCK);
    const curvePriceResult = getPoolPrice(priceResult, BEAN_3CRV)!;
    assert.assertTrue(curvePriceResult.price.equals(curvePrice));

    const beanEthPriceResult = getPoolPrice(priceResult, BEAN_WETH_CP2_WELL)!;
    assert.assertTrue(beanEthPriceResult.price.equals(beanEthPrice));
  });

  test("Price response only includes whitelisted tokens", () => {
    const event = createDewhitelistTokenEvent(BEAN_3CRV);
    event.block.number = PRICE_1_BLOCK;
    handleDewhitelistToken(event);

    const priceResult = BeanstalkPrice_try_price(PRICE_1_BLOCK);
    const curvePriceResult = getPoolPrice(priceResult, BEAN_3CRV);
    assert.assertTrue(priceResult.value.ps.length == 1);
    assert.assertTrue(priceResult.dewhitelistedPools.length == 1);
    assert.assertTrue(curvePriceResult !== null);
    assert.assertTrue(priceResult.value.price.equals(beanEthPrice));
  });

  test("Calls correct price contract by block", () => {
    const price1 = BeanstalkPrice_try_price(PRICE_1_BLOCK);
    assert.assertTrue(price1.value.price.equals(overallPrice));

    const price2 = BeanstalkPrice_try_price(PRICE_2_BLOCK);
    assert.assertTrue(price2.value.price.equals(contract2Price));
  });
});
