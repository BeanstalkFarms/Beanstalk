import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI, deltaBigIntArray, toDecimal } from "../../subgraph-core/utils/Decimals";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Shift, Swap, Sync } from "../generated/BeanWETHCP2w/Well";
import { updateBeanAfterPoolSwap } from "./utils/Bean";
import { getPoolLiquidityUSD, loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { BeanstalkPrice_try_price, getPoolPrice } from "./utils/price/BeanstalkPrice";

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsIn[0],
    event.params.tokenAmountsIn[1],
    false
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsOut[0],
    event.params.tokenAmountsOut[1],
    true
  );
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenOut == BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    event.params.tokenOut != BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    true
  );
}

export function handleSync(event: Sync): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, deltaReserves[0], deltaReserves[1], false);
}

export function handleSwap(event: Swap): void {
  handleSwapEvent(
    event.address.toHexString(),
    event.params.toToken,
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
  token1Amount: BigInt,
  removal: boolean
): void {
  // Get Price Details via Price contract
  let beanPrice = BeanstalkPrice_try_price(BEAN_ERC20, blockNumber);
  if (beanPrice.reverted) {
    return;
  }
  let wellPrice = getPoolPrice(beanPrice, Address.fromString(poolAddress))!;

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.price);
  let deltaLiquidityUSD = toDecimal(wellPrice.liquidity).minus(startingLiquidity);

  let volumeUSD = ZERO_BD;
  let volumeBean = ZERO_BI;
  if ((token0Amount == ZERO_BI || token1Amount == ZERO_BI) && removal) {
    if (token0Amount != ZERO_BI) {
      volumeBean = token0Amount.div(BigInt.fromI32(2));
      volumeUSD = toDecimal(token0Amount).times(toDecimal(wellPrice.price));
    } else {
      let wellPairInBean = toDecimal(wellPrice.balances[0]).div(toDecimal(wellPrice.balances[1], 18));
      volumeBean = BigInt.fromString(
        toDecimal(token1Amount, 18)
          .times(wellPairInBean)
          .times(BigDecimal.fromString("1000000"))
          .div(BigDecimal.fromString("2"))
          .truncate(0)
          .toString()
      );
      volumeUSD = toDecimal(volumeBean).times(toDecimal(wellPrice.price));
    }
  }

  setPoolReserves(poolAddress, wellPrice.balances, timestamp, blockNumber);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);

  updateBeanAfterPoolSwap(
    poolAddress,
    toDecimal(wellPrice.price),
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD,
    timestamp,
    blockNumber,
    beanPrice
  );
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
  let beanPrice = BeanstalkPrice_try_price(BEAN_ERC20, blockNumber);
  if (beanPrice.reverted) {
    return;
  }
  let wellPrice = getPoolPrice(beanPrice, Address.fromString(poolAddress))!;

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.price);
  let volumeBean = toToken == BEAN_ERC20 ? amountOut : amountIn;

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  let deltaLiquidityUSD = toDecimal(wellPrice.liquidity).minus(startingLiquidity);

  setPoolReserves(poolAddress, wellPrice.balances, timestamp, blockNumber);
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);

  updateBeanAfterPoolSwap(
    poolAddress,
    toDecimal(wellPrice.price),
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD,
    timestamp,
    blockNumber,
    beanPrice
  );
}
