import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BEANSTALK_PRICE, BEAN_ERC20 } from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI, deltaBigIntArray, toDecimal } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice } from "../generated/BeanWETHCP2w/BeanstalkPrice";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Shift, Swap, Sync } from "../generated/BeanWETHCP2w/Well";
import { updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { getPoolLiquidityUSD, loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsIn[0],
    event.params.tokenAmountsIn[1]
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsOut[0],
    event.params.tokenAmountsOut[1]
  );
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenOut == BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    event.params.tokenOut != BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI
  );
}

export function handleSync(event: Sync): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, deltaReserves[0], deltaReserves[1]);
}

export function handleSwap(event: Swap): void {
  handleSwapEvent(
    event.address.toHexString(),
    event.params.fromToken,
    event.params.amountIn,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );
}

export function handleShift(event: Shift): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleSwapEvent(
    event.address.toHexString(),
    event.params.toToken,
    event.params.toToken == BEAN_ERC20 ? deltaReserves[1] : deltaReserves[0],
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );
}

function handleLiquidityChange(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  token0Amount: BigInt,
  token1Amount: BigInt
): void {
  // Get Price Details via Price contract
  let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  let wellPrice = beanstalkPrice.try_getConstantProductWell(Address.fromString(poolAddress));
  let beanPrice = beanstalkPrice.try_price();

  if (wellPrice.reverted || beanPrice.reverted) {
    return;
  }

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.value.price);
  let deltaLiquidityUSD = toDecimal(wellPrice.value.liquidity).minus(startingLiquidity);

  let volumeUSD =
    deltaLiquidityUSD < ZERO_BD
      ? deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  setPoolReserves(poolAddress, wellPrice.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(
    BEAN_ERC20.toHexString(),
    timestamp,
    toDecimal(beanPrice.value.price),
    ZERO_BI,
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD
  );

  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.value.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
}

function handleSwapEvent(
  poolAddress: string,
  toToken: Address,
  amountIn: BigInt,
  amountOut: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Get Price Details via Price contract
  let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  let wellPrice = beanstalkPrice.try_getConstantProductWell(Address.fromString(poolAddress));
  let beanPrice = beanstalkPrice.try_price();

  if (wellPrice.reverted || beanPrice.reverted) {
    return;
  }

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.value.price);
  let volumeBean = toToken == BEAN_ERC20 ? amountOut : amountIn;

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  let deltaLiquidityUSD = toDecimal(wellPrice.value.liquidity).minus(startingLiquidity);

  setPoolReserves(poolAddress, wellPrice.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(
    BEAN_ERC20.toHexString(),
    timestamp,
    toDecimal(beanPrice.value.price),
    ZERO_BI,
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD
  );

  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.value.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
}
