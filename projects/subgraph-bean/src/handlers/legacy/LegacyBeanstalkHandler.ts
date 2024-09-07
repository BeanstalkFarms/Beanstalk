import { toAddress } from "../../../../subgraph-core/utils/Bytes";
import { BEAN_3CRV, BEAN_WETH_V1, CURVE_PRICE } from "../../../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../../../generated/Bean-ABIs/CurvePrice";
import { Sunrise } from "../../../generated/Bean-ABIs/PreReplant";
import { MetapoolOracle } from "../../../generated/Bean-ABIs/Replanted";
import { loadBean } from "../../entities/Bean";
import { loadOrCreatePool } from "../../entities/Pool";
import { updateBeanTwa, updateBeanValues } from "../../utils/Bean";
import { getProtocolToken } from "../../utils/constants/Addresses";
import { checkBeanCross, updatePoolPricesOnCross } from "../../utils/Cross";
import { updateSeason } from "../../utils/legacy/Beanstalk";
import { updatePoolPrice, updatePoolValues } from "../../utils/Pool";
import { calcCurveInst, setCurveTwa } from "../../utils/price/CurvePrice";
import { setTwaLast } from "../../utils/price/TwaOracle";
import { DeltaBPriceLiquidity } from "../../utils/price/Types";
import { calcUniswapV2Inst, setUniswapV2Twa } from "../../utils/price/UniswapPrice";

export function handleSunrise_v1(event: Sunrise): void {
  updateSeason(event.params.season.toI32(), event.block);

  // V1 logic below
  let beanToken = getProtocolToken(event.block.number);

  let bean = loadBean(beanToken);
  let weightedPrice = ZERO_BD;
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < bean.pools.length; i++) {
    const poolAddress = toAddress(bean.pools[i]);
    const pool = loadOrCreatePool(poolAddress, event.block.number);
    let inst: DeltaBPriceLiquidity;
    if (poolAddress == BEAN_WETH_V1) {
      inst = calcUniswapV2Inst(pool);
      setUniswapV2Twa(poolAddress, event.block);
    } else {
      inst = calcCurveInst(pool);
      setCurveTwa(poolAddress, event.block);
    }

    // Update price, liquidity, and deltaB in the pool
    updatePoolValues(poolAddress, ZERO_BI, ZERO_BD, inst.liquidity.minus(pool.liquidityUSD), inst.deltaB, event.block);
    updatePoolPrice(poolAddress, inst.price, event.block);

    weightedPrice = weightedPrice.plus(inst.price.times(inst.liquidity));
    totalLiquidity = totalLiquidity.plus(inst.liquidity);
  }

  const totalPrice = weightedPrice.div(totalLiquidity);
  updateBeanValues(beanToken, totalPrice, ZERO_BI, ZERO_BI, ZERO_BD, totalLiquidity.minus(bean.liquidityUSD), event.block);
  checkBeanCross(beanToken, bean.price, totalPrice, event.block);
  updateBeanTwa(event.block);
}

export function handleSunrise_v2(event: Sunrise): void {
  updateSeason(event.params.season.toI32(), event.block);

  // V2 logic below
  let beanToken = getProtocolToken(event.block.number);
  let bean = loadBean(beanToken);
  let oldBeanPrice = bean.price;

  // Fetch price from price contract to capture any non-bean token price movevements
  // Attempt to pull from Beanstalk Price contract first for the overall Bean price update
  // Update the current price regardless of a peg cross
  let updatedPrices = updatePoolPricesOnCross(false, event.block);

  if (!updatedPrices) {
    // Pre Basin deployment - Use original Curve price contract to update on each season.
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    let curve = curvePrice.try_getCurve();
    let beanCurve = loadOrCreatePool(BEAN_3CRV, event.block.number);

    if (!curve.reverted) {
      updateBeanValues(beanToken, toDecimal(curve.value.price), ZERO_BI, ZERO_BI, ZERO_BD, ZERO_BD, event.block);
      updatePoolValues(
        BEAN_3CRV,
        ZERO_BI,
        ZERO_BD,
        toDecimal(curve.value.liquidity).minus(beanCurve.liquidityUSD),
        curve.value.deltaB,
        event.block
      );
      updatePoolPrice(BEAN_3CRV, toDecimal(curve.value.price), event.block);
      checkBeanCross(beanToken, oldBeanPrice, toDecimal(curve.value.price), event.block);
    }
  }
}

// POST REPLANT TWA DELTAB //

export function handleMetapoolOracle(event: MetapoolOracle): void {
  setTwaLast(BEAN_3CRV, event.params.balances, event.block.timestamp);
  setCurveTwa(BEAN_3CRV, event.block);
  updateBeanTwa(event.block);
}
