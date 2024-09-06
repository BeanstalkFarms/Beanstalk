import { Address, BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { BEAN_3CRV_V1, BEAN_ERC20_V1, BEAN_LUSD_V1, CURVE_PRICE } from "../../../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { loadOrCreatePool } from "../../entities/Pool";
import { manualTwa } from "../price/TwaOracle";
import { CurvePrice } from "../../../generated/Bean-ABIs/CurvePrice";
import { getPoolLiquidityUSD } from "../Pool";
import { curveDeltaBUsingVPrice, curvePriceAndLp } from "../price/CurvePrice";
import { Bean3CRV } from "../../../generated/Bean-ABIs/Bean3CRV";
import { ERC20 } from "../../../generated/Bean-ABIs/ERC20";

class PostSwapValues {
  deltaB: BigInt;
  newPoolPrice: BigDecimal;
  reserveBalances: BigInt[];
  deltaLiquidityUSD: BigDecimal;
}

export function calcPostSwapValues(poolAddress: Address, block: ethereum.Block): PostSwapValues | null {
  let deltaB = ZERO_BI;
  let newPoolPrice = ZERO_BD;
  let reserveBalances: BigInt[] = [];
  let deltaLiquidityUSD = ZERO_BD;
  if (poolAddress === BEAN_3CRV_V1) {
    let pool = loadOrCreatePool(poolAddress, block.number);

    let priceAndLp = curvePriceAndLp(poolAddress);
    let newPoolPrice = priceAndLp[0];
    let lpValue = priceAndLp[1];

    let beanContract = ERC20.bind(BEAN_ERC20_V1);
    let beanHolding = toDecimal(beanContract.balanceOf(poolAddress));
    let beanValue = beanHolding.times(newPoolPrice);

    let liquidityUSD = beanValue.plus(lpValue);
    deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

    let lpContract = Bean3CRV.bind(poolAddress);
    reserveBalances = lpContract.get_balances();
    deltaB = curveDeltaBUsingVPrice(poolAddress, reserveBalances[0]);

    if (poolAddress == BEAN_LUSD_V1) {
      manualTwa(poolAddress, reserveBalances, block.timestamp);
    }
  } else {
    // Use curve price contract
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    let curve = curvePrice.try_getCurve();

    if (curve.reverted) {
      return null;
    }

    let startingLiquidity = getPoolLiquidityUSD(poolAddress, block);

    deltaB = curve.value.deltaB;
    newPoolPrice = toDecimal(curve.value.price);
    reserveBalances = curve.value.balances;
    deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(startingLiquidity);
  }
  return {
    deltaB,
    newPoolPrice,
    reserveBalances,
    deltaLiquidityUSD
  };
}
