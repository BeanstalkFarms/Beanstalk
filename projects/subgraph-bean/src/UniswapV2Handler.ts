import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Burn, Mint, Swap, Sync, UniswapV2Pair } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { ZERO_BD, ZERO_BI } from "./helpers";
import { updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, WETH, WETH_USDC_PAIR } from "./utils/Constants";
import { toBigInt, toDecimal } from "./utils/Decimals";
import { loadOrCreatePool, updatePoolPrice, updatePoolReserves, updatePoolValues } from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";

export function handleMint(event: Mint): void {
  updatePoolReserves(event.address.toHexString(), event.params.amount0, event.params.amount1, event.block.number);
}

export function handleBurn(event: Burn): void {
  updatePoolReserves(
    event.address.toHexString(),
    ZERO_BI.minus(event.params.amount0),
    ZERO_BI.minus(event.params.amount1),
    event.block.number
  );
}

// Liquidity and cross checks happen on the Sync event handler
export function handleSwap(event: Swap): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  let weth = loadOrCreateToken(WETH.toHexString());

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let usdVolume = toDecimal(event.params.amount0In.plus(event.params.amount0Out), 18).times(weth.lastPriceUSD);

  // Token 0 is WETH and Token 1 is BEAN

  updatePoolValues(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.amount1In.plus(event.params.amount1Out),
    usdVolume,
    ZERO_BD,
    pool.deltaBeans
  );

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, pool.lastPrice, ZERO_BI, ZERO_BI, usdVolume, ZERO_BD);

  updatePoolReserves(
    event.address.toHexString(),
    event.params.amount0In.minus(event.params.amount0Out),
    event.params.amount1In.minus(event.params.amount1Out),
    event.block.number
  );
}

// Sync is called in UniswapV2 on any liquidity or swap transaction.
// It updates the `reserves` value on the contract.

export function handleSync(event: Sync): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  let pair = UniswapV2Pair.bind(event.address);

  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return;
  }

  // Token 0 is WETH and Token 1 is BEAN

  updatePriceETH();
  let weth = loadOrCreateToken(WETH.toHexString());

  let wethBalance = toDecimal(reserves.value.value0, 18);
  let beanBalance = toDecimal(reserves.value.value1);

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);
  let startLiquidityUSD = pool.liquidityUSD;
  let endLiquidityUSD = wethBalance.times(weth.lastPriceUSD).times(BigDecimal.fromString("2"));
  let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD);
  let deltaBeans = toBigInt(beanBalance.minus(wethBalance.times(weth.lastPriceUSD)), 6);

  updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, deltaBeans);

  let currentBeanPrice = beanBalance.div(wethBalance.times(weth.lastPriceUSD));

  updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, currentBeanPrice);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, currentBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD);
}

function updatePriceETH(): void {
  let token = loadOrCreateToken(WETH.toHexString());
  let pair = UniswapV2Pair.bind(WETH_USDC_PAIR);

  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return;
  }

  // Token 0 is USDC and Token 1 is WETH
  token.lastPriceUSD = toDecimal(reserves.value.value0).div(toDecimal(reserves.value.value1, 18));
  token.save();
}
