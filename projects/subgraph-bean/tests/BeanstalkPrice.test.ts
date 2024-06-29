import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test, log } from "matchstick-as/assembly/index";
import { loadBean } from "../src/utils/Bean";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, BEAN_WETH_CP2_WELL_BLOCK, CRV3_TOKEN, WETH } from "../../subgraph-core/utils/Constants";
import { handleDewhitelistToken } from "../src/BeanstalkHandler";
import { createDewhitelistTokenEvent } from "./event-mocking/Beanstalk";
import { setMockBeanPrice } from "../../subgraph-core/tests/event-mocking/Price";
import { BigInt } from "@graphprotocol/graph-ts";
import { BI_10 } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice_try_price, getPoolPrice } from "../src/utils/price/BeanstalkPrice";

const curvePrice = BigInt.fromU32(1012000);
const beanEthPrice = BigInt.fromU32(1025000);
const overallPrice = BigInt.fromU32(1022833);
const curveLiquidity = BigInt.fromU32(1000000).times(BI_10.pow(6));
const beanEthLiquidity = BigInt.fromU32(5000000).times(BI_10.pow(6));
const curveDelta = BigInt.fromI32(500).times(BI_10.pow(6));
const beanEthDelta = BigInt.fromI32(7500).times(BI_10.pow(6));

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
  });

  beforeEach(() => {
    let bean = loadBean(BEAN_ERC20.toHexString());
    bean.pools = [BEAN_3CRV.toHexString(), BEAN_WETH_CP2_WELL.toHexString()];
    bean.save();
  });

  afterEach(() => {
    // log.debug("clearing the store", []);
    clearStore();
  });

  test("Can set the price", () => {
    const priceResult = BeanstalkPrice_try_price(BEAN_ERC20, BEAN_WETH_CP2_WELL_BLOCK);
    assert.assertTrue(priceResult.value.price.equals(overallPrice));
    assert.assertTrue(priceResult.value.ps.length == 2);
    assert.assertTrue(priceResult.dewhitelistedPools.length == 0);
  });

  test("Extract pool price", () => {
    const priceResult = BeanstalkPrice_try_price(BEAN_ERC20, BEAN_WETH_CP2_WELL_BLOCK);
    const curvePriceResult = getPoolPrice(priceResult, BEAN_3CRV)!;
    assert.assertTrue(curvePriceResult.price.equals(curvePrice));

    const beanEthPriceResult = getPoolPrice(priceResult, BEAN_WETH_CP2_WELL)!;
    assert.assertTrue(beanEthPriceResult.price.equals(beanEthPrice));
  });

  test("Price response only includes whitelisted tokens", () => {
    const event = createDewhitelistTokenEvent(BEAN_3CRV.toHexString());
    event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
    handleDewhitelistToken(event);

    const priceResult = BeanstalkPrice_try_price(BEAN_ERC20, BEAN_WETH_CP2_WELL_BLOCK);
    const curvePriceResult = getPoolPrice(priceResult, BEAN_3CRV);
    assert.assertTrue(priceResult.value.ps.length == 1);
    assert.assertTrue(priceResult.dewhitelistedPools.length == 1);
    assert.assertTrue(curvePriceResult !== null);
    assert.assertTrue(priceResult.value.price.equals(beanEthPrice));
  });
});
