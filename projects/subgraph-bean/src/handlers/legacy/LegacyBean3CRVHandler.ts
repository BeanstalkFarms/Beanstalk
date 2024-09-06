import { BigInt, BigDecimal, ethereum, Address } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  Bean3CRV,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../../../generated/Bean-ABIs/Bean3CRV";
import { updateBeanAfterPoolSwap } from "../../utils/Bean";
import { BEAN_3CRV_V1, BEAN_ERC20_V1, BEAN_LUSD_V1, CURVE_PRICE } from "../../../../subgraph-core/utils/Constants";
import { curveDeltaBUsingVPrice, curvePriceAndLp } from "../../utils/price/CurvePrice";
import { loadOrCreatePool } from "../../entities/Pool";
import { ERC20 } from "../../../generated/Bean-ABIs/ERC20";
import { manualTwa } from "../../utils/price/TwaOracle";
import { getPoolLiquidityUSD, setPoolReserves, updatePoolPrice, updatePoolValues } from "../../utils/Pool";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../../../generated/Bean-ABIs/CurvePrice";

export function handleTokenExchange(event: TokenExchange): void {
  handleSwap(
    event.address,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block
  );
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
  handleSwap(
    event.address,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block
  );
}

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  handleLiquidityChange(event.address, false, event.block);
}

function handleLiquidityChange(poolAddress: Address, isBoth: boolean, block: ethereum.Block): void {
  // TODO: refactor this part out from liquidity and swap so it is not repeated
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
      return;
    }

    let startingLiquidity = getPoolLiquidityUSD(poolAddress, block);

    deltaB = curve.value.deltaB;
    newPoolPrice = toDecimal(curve.value.price);
    reserveBalances = curve.value.balances;
    deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(startingLiquidity);
  }

  let volumeUSD =
    deltaLiquidityUSD < ZERO_BD
      ? deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(newPoolPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  // Ideally this would constitute volume if both tokens are involved, but not in equal proportion.
  if (isBoth) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  setPoolReserves(poolAddress, reserveBalances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB, block);
  updatePoolPrice(poolAddress, newPoolPrice, block);

  updateBeanAfterPoolSwap(poolAddress, newPoolPrice, volumeBean, volumeUSD, deltaLiquidityUSD, block);
}

function handleSwap(
  poolAddress: Address,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt,
  block: ethereum.Block
): void {
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
      return;
    }

    let startingLiquidity = getPoolLiquidityUSD(poolAddress, block);

    deltaB = curve.value.deltaB;
    newPoolPrice = toDecimal(curve.value.price);
    reserveBalances = curve.value.balances;
    deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(startingLiquidity);
  }

  let volumeBean = ZERO_BI;
  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }
  let volumeUSD = toDecimal(volumeBean).times(newPoolPrice);

  setPoolReserves(poolAddress, reserveBalances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB, block);
  updatePoolPrice(poolAddress, newPoolPrice, block);

  updateBeanAfterPoolSwap(poolAddress, newPoolPrice, volumeBean, volumeUSD, deltaLiquidityUSD, block);
}
