import { BigInt } from "@graphprotocol/graph-ts";
import { beanstalkPrice_updatePoolPrices } from "./BlockHandler";
import { getBeanTokenAddress, updateBeanSeason, updateBeanSupplyPegPercent, updateBeanTwa, updateBeanValues } from "../utils/Bean";
import { Chop, Convert, DewhitelistToken, Reward, Sunrise } from "../../generated/Bean-ABIs/Beanstalk";
import { CurvePrice } from "../../generated/Bean-ABIs/CurvePrice";
import { BEAN_3CRV, BEAN_WETH_V1, CURVE_PRICE } from "../../../subgraph-core/utils/Constants";
import { loadOrCreatePool } from "../entities/Pool";
import { updatePoolPrice, updatePoolSeason, updatePoolValues } from "../utils/Pool";
import { loadBean } from "../entities/Bean";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { checkBeanCross } from "../utils/Cross";
import { DeltaBPriceLiquidity } from "../utils/price/Types";
import { calcUniswapV2Inst, setUniswapV2Twa } from "../utils/price/UniswapPrice";
import { calcCurveInst, setCurveTwa } from "../utils/price/CurvePrice";
import { MetapoolOracle, WellOracle } from "../../generated/Bean-ABIs/BIP37";
import { setRawWellReserves, setTwaLast } from "../utils/price/TwaOracle";
import { decodeCumulativeWellReserves, setWellTwa } from "../utils/price/WellPrice";
import { isUnripe } from "../utils/constants/Addresses";

export function handleSunrise(event: Sunrise): void {
  // Update the season for hourly and daily liquidity metrics

  let beanToken = getBeanTokenAddress(event.block.number);

  updateBeanSeason(beanToken, event.block.timestamp, event.params.season.toI32());

  let bean = loadBean(beanToken);
  let oldBeanPrice = bean.price;
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(bean.pools[i], event.params.season.toI32(), event.block);
  }

  for (let i = 0; i < bean.dewhitelistedPools.length; i++) {
    updatePoolSeason(bean.dewhitelistedPools[i], event.params.season.toI32(), event.block);
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
        updateBeanValues(beanToken, toDecimal(curve.value.price), ZERO_BI, ZERO_BI, ZERO_BD, ZERO_BD, event.block);
        updatePoolValues(
          BEAN_3CRV.toHexString(),
          ZERO_BI,
          ZERO_BD,
          toDecimal(curve.value.liquidity).minus(beanCurve.liquidityUSD),
          curve.value.deltaB,
          event.block
        );
        updatePoolPrice(BEAN_3CRV.toHexString(), toDecimal(curve.value.price), event.block);
        checkBeanCross(beanToken, oldBeanPrice, toDecimal(curve.value.price), event.block);
      }
    }
  } else {
    // Pre-Replant
    let bean = loadBean(beanToken);
    let weightedPrice = ZERO_BD;
    let totalLiquidity = ZERO_BD;
    for (let i = 0; i < bean.pools.length; i++) {
      const pool = loadOrCreatePool(bean.pools[i], event.block.number);
      let inst: DeltaBPriceLiquidity;
      if (bean.pools[i] == BEAN_WETH_V1.toHexString()) {
        inst = calcUniswapV2Inst(pool);
        setUniswapV2Twa(bean.pools[i], event.block);
      } else {
        inst = calcCurveInst(pool);
        setCurveTwa(bean.pools[i], event.block);
      }

      // Update price, liquidity, and deltaB in the pool
      updatePoolValues(bean.pools[i], ZERO_BI, ZERO_BD, inst.liquidity.minus(pool.liquidityUSD), inst.deltaB, event.block);
      updatePoolPrice(bean.pools[i], inst.price, event.block);

      weightedPrice = weightedPrice.plus(inst.price.times(inst.liquidity));
      totalLiquidity = totalLiquidity.plus(inst.liquidity);
    }

    const totalPrice = weightedPrice.div(totalLiquidity);
    updateBeanValues(beanToken, totalPrice, ZERO_BI, ZERO_BI, ZERO_BD, totalLiquidity.minus(bean.liquidityUSD), event.block);
    checkBeanCross(beanToken, bean.price, totalPrice, event.block);
    updateBeanTwa(event.block);
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
  setCurveTwa(BEAN_3CRV.toHexString(), event.block);
  updateBeanTwa(event.block);
}

export function handleWellOracle(event: WellOracle): void {
  setRawWellReserves(event);
  setTwaLast(event.params.well.toHexString(), decodeCumulativeWellReserves(event.params.cumulativeReserves), event.block.timestamp);
  setWellTwa(event.params.well.toHexString(), event.params.deltaB, event.block);
  updateBeanTwa(event.block);
}

// LOCKED BEANS //

// Locked beans are a function of the number of unripe assets, and the chop rate.
// In addition to during a swap, it should be updated according to chops, bean mints, and fertilizer purchases.
// The result of fertilizer purchases will be included by the AddLiquidity event

export function handleChop(event: Chop): void {
  updateBeanSupplyPegPercent(event.block.number);
}

export function handleConvert(event: Convert): void {
  if (isUnripe(event.params.fromToken) && !isUnripe(event.params.toToken)) {
    updateBeanSupplyPegPercent(event.block.number);
  }
}

export function handleRewardMint(event: Reward): void {
  updateBeanSupplyPegPercent(event.block.number);
}
