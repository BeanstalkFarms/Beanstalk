import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Chop, DewhitelistToken, Reward, Sunrise } from "../generated/Beanstalk/Beanstalk";
import { getBeanTokenAddress, loadBean, updateBeanSeason, updateBeanSupplyPegPercent, updateBeanTwa, updateBeanValues } from "./utils/Bean";
import { loadOrCreatePool, updatePoolPrice, updatePoolSeason, updatePoolValues } from "./utils/Pool";
import { BeanstalkPrice } from "../generated/Beanstalk/BeanstalkPrice";
import {
  BEANSTALK_PRICE,
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_ERC20_V1,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_V1,
  CURVE_PRICE
} from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI, toDecimal } from "../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../generated/Beanstalk/CurvePrice";
import { checkBeanCross } from "./utils/Cross";
import { calcUniswapV2Inst, setUniswapV2Twa } from "./utils/price/UniswapPrice";
import { calcCurveInst, setCurveTwa } from "./utils/price/CurvePrice";
import { MetapoolOracle, WellOracle } from "../generated/TWAPOracles/BIP37";
import { DeltaBPriceLiquidity } from "./utils/price/Types";
import { setRawWellReserves, setTwaLast } from "./utils/price/TwaOracle";
import { decodeCumulativeWellReserves, setWellTwa } from "./utils/price/WellPrice";
import { BeanstalkPrice_try_price, getPoolPrice } from "./utils/price/BeanstalkPrice";
import { beanstalkPrice_updatePoolPrices } from "./BlockHandler";

export function handleSunrise(event: Sunrise): void {
  // Update the season for hourly and daily liquidity metrics

  let beanToken = getBeanTokenAddress(event.block.number);

  updateBeanSeason(beanToken, event.block.timestamp, event.params.season.toI32());

  let bean = loadBean(beanToken);
  let oldBeanPrice = bean.price;
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(bean.pools[i], event.block.timestamp, event.block.number, event.params.season.toI32());
  }

  for (let i = 0; i < bean.dewhitelistedPools.length; i++) {
    updatePoolSeason(bean.dewhitelistedPools[i], event.block.timestamp, event.block.number, event.params.season.toI32());
  }

  // Fetch price from price contract to capture any non-bean token price movevements
  if (event.params.season > BigInt.fromI32(6074)) {
    // Attempt to pull from Beanstalk Price contract first for the overall Bean price update
    // Update the current price regardless of a peg cross
    let updatedPrices = beanstalkPrice_updatePoolPrices(false, event.block);

    if (!updatedPrices) {
      // Pre Basin deployment - Use original Curve price contract to update on each season.
      let curvePrice = CurvePrice.bind(CURVE_PRICE);
      let curve = curvePrice.try_getCurve();
      let beanCurve = loadOrCreatePool(BEAN_3CRV.toHexString(), event.block.number);

      if (!curve.reverted) {
        updateBeanValues(BEAN_ERC20.toHexString(), event.block.timestamp, toDecimal(curve.value.price), ZERO_BI, ZERO_BI, ZERO_BD, ZERO_BD);
        updatePoolValues(
          BEAN_3CRV.toHexString(),
          event.block.timestamp,
          event.block.number,
          ZERO_BI,
          ZERO_BD,
          toDecimal(curve.value.liquidity).minus(beanCurve.liquidityUSD),
          curve.value.deltaB
        );
        updatePoolPrice(BEAN_3CRV.toHexString(), event.block.timestamp, event.block.number, toDecimal(curve.value.price));
        checkBeanCross(BEAN_ERC20.toHexString(), event.block.timestamp, event.block.number, oldBeanPrice, toDecimal(curve.value.price));
      }
    }
  } else {
    // Pre-Replant
    let bean = loadBean(BEAN_ERC20_V1.toHexString());
    let weightedPrice = ZERO_BD;
    let totalLiquidity = ZERO_BD;
    for (let i = 0; i < bean.pools.length; i++) {
      const pool = loadOrCreatePool(bean.pools[i], event.block.number);
      let inst: DeltaBPriceLiquidity;
      if (bean.pools[i] == BEAN_WETH_V1.toHexString()) {
        inst = calcUniswapV2Inst(pool);
        setUniswapV2Twa(bean.pools[i], event.block.timestamp, event.block.number);
      } else {
        inst = calcCurveInst(pool);
        setCurveTwa(bean.pools[i], event.block.timestamp, event.block.number);
      }

      // Update price, liquidity, and deltaB in the pool
      updatePoolValues(
        bean.pools[i],
        event.block.timestamp,
        event.block.number,
        ZERO_BI,
        ZERO_BD,
        inst.liquidity.minus(pool.liquidityUSD),
        inst.deltaB
      );
      updatePoolPrice(bean.pools[i], event.block.timestamp, event.block.number, inst.price);

      weightedPrice = weightedPrice.plus(inst.price.times(inst.liquidity));
      totalLiquidity = totalLiquidity.plus(inst.liquidity);
    }

    const totalPrice = weightedPrice.div(totalLiquidity);
    updateBeanValues(
      BEAN_ERC20_V1.toHexString(),
      event.block.timestamp,
      totalPrice,
      ZERO_BI,
      ZERO_BI,
      ZERO_BD,
      totalLiquidity.minus(bean.liquidityUSD)
    );
    checkBeanCross(BEAN_ERC20_V1.toHexString(), event.block.timestamp, event.block.number, bean.price, totalPrice);
    updateBeanTwa(event.block.timestamp, event.block.number);
  }
}

// Assumption is that the whitelisted token corresponds to a pool lp. If not, this method will simply do nothing.
export function handleDewhitelistToken(event: DewhitelistToken): void {
  let bean = loadBean(getBeanTokenAddress(event.block.number));
  let index = bean.pools.indexOf(event.params.token.toHexString());
  if (index >= 0) {
    const newPools = bean.pools;
    const newDewhitelistedPools = bean.dewhitelistedPools;
    newDewhitelistedPools.push(newPools.splice(index, 1)[0]);
    bean.pools = newPools;
    bean.dewhitelistedPools = newDewhitelistedPools;
    bean.save();
  }
}

// POST REPLANT TWA DELTAB //

export function handleMetapoolOracle(event: MetapoolOracle): void {
  setTwaLast(BEAN_3CRV.toHexString(), event.params.balances, event.block.timestamp);
  setCurveTwa(BEAN_3CRV.toHexString(), event.block.timestamp, event.block.number);
  updateBeanTwa(event.block.timestamp, event.block.number);
}

export function handleWellOracle(event: WellOracle): void {
  setRawWellReserves(event);
  setTwaLast(event.params.well.toHexString(), decodeCumulativeWellReserves(event.params.cumulativeReserves), event.block.timestamp);
  setWellTwa(event.params.well.toHexString(), event.params.deltaB, event.block.timestamp, event.block.number);
  updateBeanTwa(event.block.timestamp, event.block.number);
}

// LOCKED BEANS //

// Locked beans are a function of the number of unripe assets, and the chop rate.
// In addition to during a swap, it should be updated according to chops, bean mints, and fertilizer purchases.
// The result of fertilizer purchases will be included by the AddLiquidity event

export function handleChop(event: Chop): void {
  updateBeanSupplyPegPercent(event.block.number);
}

export function handleRewardMint(event: Reward): void {
  updateBeanSupplyPegPercent(event.block.number);
}
