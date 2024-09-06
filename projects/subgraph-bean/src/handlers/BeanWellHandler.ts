import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Shift, Swap, Sync } from "../../generated/Bean-ABIs/Well";
import { deltaBigIntArray, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BEAN_ERC20 } from "../../../subgraph-core/utils/Constants";
import { loadOrCreatePool } from "../entities/Pool";
import { BeanstalkPrice_try_price, getPoolPrice } from "../utils/price/BeanstalkPrice";
import { getPoolLiquidityUSD, setPoolReserves, updatePoolPrice, updatePoolValues } from "../utils/Pool";
import { updateBeanAfterPoolSwap } from "../utils/Bean";

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(event.address.toHexString(), event.params.tokenAmountsIn[0], event.params.tokenAmountsIn[1], false, event.block);
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(event.address.toHexString(), event.params.tokenAmountsOut[0], event.params.tokenAmountsOut[1], true, event.block);
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.params.tokenOut == BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    event.params.tokenOut != BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    true,
    event.block
  );
}

export function handleSync(event: Sync): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleLiquidityChange(event.address.toHexString(), deltaReserves[0], deltaReserves[1], false, event.block);
}

export function handleSwap(event: Swap): void {
  handleSwapEvent(event.address.toHexString(), event.params.toToken, event.params.amountIn, event.params.amountOut, event.block);
}

export function handleShift(event: Shift): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleSwapEvent(
    event.address.toHexString(),
    event.params.toToken,
    event.params.toToken == BEAN_ERC20 ? deltaReserves[1] : deltaReserves[0],
    event.params.amountOut,
    event.block
  );
}

function handleLiquidityChange(
  poolAddress: string,
  token0Amount: BigInt,
  token1Amount: BigInt,
  removal: boolean,
  block: ethereum.Block
): void {
  // Get Price Details via Price contract
  let beanPrice = BeanstalkPrice_try_price(BEAN_ERC20, block.number);
  if (beanPrice.reverted) {
    return;
  }
  let wellPrice = getPoolPrice(beanPrice, Address.fromString(poolAddress));
  if (wellPrice == null) {
    return;
  }

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, block);

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

  setPoolReserves(poolAddress, wellPrice.balances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.deltaB, block);
  updatePoolPrice(poolAddress, newPrice, block);

  updateBeanAfterPoolSwap(poolAddress, toDecimal(wellPrice.price), volumeBean, volumeUSD, deltaLiquidityUSD, block, beanPrice);
}

function handleSwapEvent(poolAddress: string, toToken: Address, amountIn: BigInt, amountOut: BigInt, block: ethereum.Block): void {
  // Get Price Details via Price contract
  let beanPrice = BeanstalkPrice_try_price(BEAN_ERC20, block.number);
  if (beanPrice.reverted) {
    return;
  }
  let wellPrice = getPoolPrice(beanPrice, Address.fromString(poolAddress));
  if (wellPrice == null) {
    return;
  }

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, block);

  let newPrice = toDecimal(wellPrice.price);
  let volumeBean = toToken == BEAN_ERC20 ? amountOut : amountIn;

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  let deltaLiquidityUSD = toDecimal(wellPrice.liquidity).minus(startingLiquidity);

  setPoolReserves(poolAddress, wellPrice.balances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.deltaB, block);
  updatePoolPrice(poolAddress, newPrice, block);

  updateBeanAfterPoolSwap(poolAddress, toDecimal(wellPrice.price), volumeBean, volumeUSD, deltaLiquidityUSD, block, beanPrice);
}