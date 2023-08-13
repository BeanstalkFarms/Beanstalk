import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../generated/Bean3CRV/Bean3CRV";
import { CurvePrice } from "../generated/Bean3CRV/CurvePrice";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20, CURVE_PRICE } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";

export function handleTokenExchange(event: TokenExchange): void {
  handleSwap(
    event.address.toHexString(),
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block.timestamp,
    event.block.number
  );
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
  handleSwap(
    event.address.toHexString(),
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block.timestamp,
    event.block.number
  );
}

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.token_amounts[0],
    event.params.token_amounts[1]
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.token_amounts[0],
    event.params.token_amounts[1]
  );
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.token_amounts[0],
    event.params.token_amounts[1]
  );
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, event.params.coin_amount, ZERO_BI);
}

function handleLiquidityChange(pool: string, timestamp: BigInt, blockNumber: BigInt, token0Amount: BigInt, token1Amount: BigInt): void {
  // Get Curve Price Details
  let curvePrice = CurvePrice.bind(CURVE_PRICE);
  let curve = curvePrice.try_getCurve();

  if (curve.reverted) {
    return;
  }

  let bean = loadBean(BEAN_ERC20.toHexString());

  let newPrice = toDecimal(curve.value.price);
  let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.liquidityUSD);

  let volumeUSD =
    deltaLiquidityUSD < ZERO_BD
      ? deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  setPoolReserves(pool, curve.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(BEAN_ERC20.toHexString(), timestamp, toDecimal(curve.value.price), ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);

  updatePoolValues(pool, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, curve.value.deltaB);
  updatePoolPrice(pool, timestamp, blockNumber, newPrice);
}

function handleSwap(
  pool: string,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Get Curve Price Details
  let curvePrice = CurvePrice.bind(CURVE_PRICE);
  let curve = curvePrice.try_getCurve();

  if (curve.reverted) {
    return;
  }

  let bean = loadBean(BEAN_ERC20.toHexString());

  let newPrice = toDecimal(curve.value.price);
  let volumeBean = ZERO_BI;

  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }
  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.liquidityUSD);

  setPoolReserves(pool, curve.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(BEAN_ERC20.toHexString(), timestamp, toDecimal(curve.value.price), ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);

  updatePoolValues(pool, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, curve.value.deltaB);
  updatePoolPrice(pool, timestamp, blockNumber, newPrice);
}
