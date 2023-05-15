import { BigInt, BigDecimal, Address, log } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../generated/Bean3CRV/Bean3CRV";
import { loadBean, updateBeanValues } from "./utils/Bean";
import {
  BEAN_3CRV_V1,
  BEAN_ERC20_V1,
  BEAN_ERC20_V2,
  BEAN_LUSD_V1,
  CALCULATIONS_CURVE,
  CRV3_POOL,
  CRV3_POOL_V1,
  CURVE_PRICE,
  LUSD_3POOL
} from "./utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "./utils/Decimals";
import { loadOrCreatePool, updatePoolPrice, updatePoolReserves, updatePoolValues } from "./utils/Pool";
import { CalculationsCurve } from "../generated/Bean3CRV-V1/CalculationsCurve";
import { Bean3CRV } from "../generated/Bean3CRV-V1/Bean3CRV";
import { ERC20 } from "../generated/Bean3CRV-V1/ERC20";

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

  if (event.params.provider == BEAN_ERC20_V1)
    handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, event.params.token_amount, ZERO_BI);
  else handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, event.params.token_amount);
}

function handleLiquidityChange(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  token0Amount: BigInt,
  token1Amount: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);

  // Get Curve Price Details
  let curveCalc = CalculationsCurve.bind(CALCULATIONS_CURVE);
  let metapoolPrice = toDecimal(curveCalc.getCurvePriceUsdc(CRV3_POOL_V1));

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));
  let beanCrvPrice = ZERO_BD;

  if (poolAddress == BEAN_3CRV_V1.toHexString()) {
    beanCrvPrice = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);
  } else if (poolAddress == BEAN_LUSD_V1.toHexString()) {
    // price in LUSD
    let priceInLusd = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);
    log.info("LiquidityChange: Bean LUSD price: {}", [priceInLusd.toString()]);

    let lusdContract = Bean3CRV.bind(LUSD_3POOL);
    log.info("LiquidityChange: LUSD Crv price {}", [
      toDecimal(lusdContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18).toString()
    ]);

    let lusd3crvPrice = toDecimal(lusdContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18);
    beanCrvPrice = priceInLusd.times(lusd3crvPrice);
  }

  log.info("LiquidityChange: Bean Crv price: {}", [beanCrvPrice.toString()]);

  let newPrice = metapoolPrice.times(beanCrvPrice);

  log.info("LiquidityChange: Bean USD price: {}", [newPrice.toString()]);

  let bean = loadBean(BEAN_ERC20_V1.toHexString());

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let crv3PoolContract = ERC20.bind(CRV3_POOL_V1);

  let beanHolding = toDecimal(beanContract.balanceOf(BEAN_3CRV_V1));
  let crvHolding = toDecimal(crv3PoolContract.balanceOf(BEAN_3CRV_V1), 18);

  let beanValue = beanHolding.times(newPrice);
  let crvValue = crvHolding.times(metapoolPrice);

  let deltaB = BigInt.fromString(
    crvHolding.times(metapoolPrice).minus(beanHolding).times(BigDecimal.fromString("1000000")).truncate(0).toString()
  );

  let liquidityUSD = beanValue.plus(crvValue);

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

  updateBeanValues(BEAN_ERC20_V1.toHexString(), timestamp, newPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  updatePoolReserves(poolAddress, token0Amount, token1Amount, blockNumber);
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

  // Get Curve Price Details
  let curveCalc = CalculationsCurve.bind(CALCULATIONS_CURVE);
  let metapoolPrice = toDecimal(curveCalc.getCurvePriceUsdc(CRV3_POOL_V1));

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));
  let beanCrvPrice = ZERO_BD;

  if (poolAddress == BEAN_3CRV_V1.toHexString()) {
    beanCrvPrice = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);
  } else if (poolAddress == BEAN_LUSD_V1.toHexString()) {
    // price in LUSD
    let priceInLusd = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);
    log.info("LiquidityChange: Bean LUSD price: {}", [priceInLusd.toString()]);

    let lusdContract = Bean3CRV.bind(LUSD_3POOL);
    log.info("LiquidityChange: LUSD Crv price {}", [
      toDecimal(lusdContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18).toString()
    ]);

    let lusd3crvPrice = toDecimal(lusdContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18);
    beanCrvPrice = priceInLusd.times(lusd3crvPrice);
  }

  log.info("LiquidityChange: Bean Crv price: {}", [beanCrvPrice.toString()]);

  let newPrice = metapoolPrice.times(beanCrvPrice);

  log.info("LiquidityChange: Bean USD price: {}", [newPrice.toString()]);

  let bean = loadBean(BEAN_ERC20_V1.toHexString());

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let crv3PoolContract = ERC20.bind(CRV3_POOL_V1);

  let beanHolding = toDecimal(beanContract.balanceOf(BEAN_3CRV_V1));
  let crvHolding = toDecimal(crv3PoolContract.balanceOf(BEAN_3CRV_V1), 18);

  let beanValue = beanHolding.times(newPrice);
  let crvValue = crvHolding.times(metapoolPrice);

  let deltaB = BigInt.fromString(
    crvHolding.times(metapoolPrice).minus(beanHolding).times(BigDecimal.fromString("1000000")).truncate(0).toString()
  );

  let liquidityUSD = beanValue.plus(crvValue);

  let deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

  let volumeBean = ZERO_BI;
  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  updateBeanValues(BEAN_ERC20_V1.toHexString(), timestamp, newPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  updatePoolReserves(
    poolAddress,
    sold_id == ZERO_BI ? tokens_sold : tokens_bought,
    sold_id == ZERO_BI ? tokens_bought : tokens_sold,
    blockNumber
  );
}
