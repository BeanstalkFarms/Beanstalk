import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../generated/Bean3CRV/Bean3CRV";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_3CRV_V1, BEAN_ERC20_V1, BEAN_LUSD_V1, CRV3_POOL, LUSD_3POOL } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import {
  loadOrCreatePool,
  loadOrCreatePoolDailySnapshot,
  loadOrCreatePoolHourlySnapshot,
  setPoolReserves,
  updatePoolPrice,
  updatePoolValues
} from "./utils/Pool";
import { Bean3CRV } from "../generated/Bean3CRV-V1/Bean3CRV";
import { ERC20 } from "../generated/Bean3CRV-V1/ERC20";
import { checkBeanCross } from "./utils/Cross";
import { curveDeltaB, curvePriceAndLp, curveTwaDeltaBAndPrice } from "./utils/price/CurvePrice";
import { manualTwa } from "./utils/price/TwaOracle";

export function handleTokenExchange(event: TokenExchange): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

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
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

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
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.token_amounts[0],
    event.params.token_amounts[1]
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    ZERO_BI.minus(event.params.token_amounts[0]),
    ZERO_BI.minus(event.params.token_amounts[1])
  );
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    ZERO_BI.minus(event.params.token_amounts[0]),
    ZERO_BI.minus(event.params.token_amounts[1])
  );
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  if (event.params.provider == BEAN_ERC20_V1) {
    handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, event.params.token_amount, ZERO_BI);
  } else {
    handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, event.params.token_amount);
  }
}

function handleLiquidityChange(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  token0Amount: BigInt,
  token1Amount: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));

  let priceAndLp = curvePriceAndLp(Address.fromString(poolAddress));
  let newPrice = priceAndLp[0];
  let lpValue = priceAndLp[1];

  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  let oldBeanPrice = bean.price;

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let beanHolding = toDecimal(beanContract.balanceOf(Address.fromString(poolAddress)));
  let beanValue = beanHolding.times(newPrice);

  let liquidityUSD = beanValue.plus(lpValue);
  let deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

  let volumeUSD =
    deltaLiquidityUSD < ZERO_BD
      ? deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  let reserveBalances = lpContract.try_get_balances();
  if (!reserveBalances.reverted) {
    setPoolReserves(poolAddress, reserveBalances.value, timestamp, blockNumber);
    if (poolAddress == BEAN_LUSD_V1.toHexString()) {
      manualTwa(poolAddress, reserveBalances.value, timestamp);
    }
  }

  let deltaB = curveDeltaB(Address.fromString(poolAddress), reserveBalances.value[0]);

  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), timestamp, newPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  checkBeanCross(BEAN_ERC20_V1.toHexString(), timestamp, blockNumber, oldBeanPrice, newPrice);
}

function handleSwap(
  poolAddress: string,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));

  let priceAndLp = curvePriceAndLp(Address.fromString(poolAddress));
  let newPrice = priceAndLp[0];
  let lpValue = priceAndLp[1];

  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  let oldBeanPrice = bean.price;

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let beanHolding = toDecimal(beanContract.balanceOf(Address.fromString(poolAddress)));
  let beanValue = beanHolding.times(newPrice);

  let liquidityUSD = beanValue.plus(lpValue);
  let deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

  let volumeBean = ZERO_BI;
  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }

  let reserveBalances = lpContract.try_get_balances();
  if (!reserveBalances.reverted) {
    setPoolReserves(poolAddress, reserveBalances.value, timestamp, blockNumber);
    if (poolAddress == BEAN_LUSD_V1.toHexString()) {
      manualTwa(poolAddress, reserveBalances.value, timestamp);
    }
  }

  let deltaB = curveDeltaB(Address.fromString(poolAddress), reserveBalances.value[0]);

  updateBeanSupplyPegPercent(blockNumber);

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  updateBeanValues(BEAN_ERC20_V1.toHexString(), timestamp, newPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  checkBeanCross(BEAN_ERC20_V1.toHexString(), timestamp, blockNumber, oldBeanPrice, newPrice);
}
