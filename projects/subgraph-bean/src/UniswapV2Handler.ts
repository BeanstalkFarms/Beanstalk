import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Swap, Sync, UniswapV2Pair } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, BEAN_WETH_V1, WETH, WETH_USDC_PAIR } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";
import { checkBeanCross, checkPoolCross } from "./utils/Cross";
import { uniswapV2DeltaB, uniswapV2Price, uniswapV2Reserves, updatePreReplantPriceETH } from "./utils/price/UniswapPrice";

// export function handleMint(event: Mint): void {
//   updatePoolReserves(event.address.toHexString(), event.params.amount0, event.params.amount1, event.block.number);

//   updateBeanSupplyPegPercent(event.block.number);
// }

// export function handleBurn(event: Burn): void {
//   updatePoolReserves(
//     event.address.toHexString(),
//     ZERO_BI.minus(event.params.amount0),
//     ZERO_BI.minus(event.params.amount1),
//     event.block.number
//   );

//   updateBeanSupplyPegPercent(event.block.number);
// }

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

  let newReserves = [
    pool.reserves[0].plus(event.params.amount0In.minus(event.params.amount0Out)),
    pool.reserves[1].plus(event.params.amount1In.minus(event.params.amount1Out))
  ];

  setPoolReserves(event.address.toHexString(), newReserves, event.block.timestamp, event.block.number);

  updateBeanSupplyPegPercent(event.block.number);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, pool.lastPrice, ZERO_BI, ZERO_BI, usdVolume, ZERO_BD);
}

// Sync is called in UniswapV2 on any liquidity or swap transaction.
// It updates the `reserves` value on the contract.

export function handleSync(event: Sync): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  let oldBeanPrice = bean.price;

  let reserves = uniswapV2Reserves(event.address);

  // Token 0 is WETH and Token 1 is BEAN

  let weth = updatePreReplantPriceETH();

  const weth_bd = toDecimal(reserves[0], 18);
  const bean_bd = toDecimal(reserves[1]);

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);
  let startLiquidityUSD = pool.liquidityUSD;
  let endLiquidityUSD = weth_bd.times(weth.lastPriceUSD).times(BigDecimal.fromString("2"));
  let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD);
  let deltaBeans = uniswapV2DeltaB(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, deltaBeans);

  let currentBeanPrice = uniswapV2Price(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, currentBeanPrice);

  checkBeanCross(BEAN_ERC20_V1.toHexString(), event.block.timestamp, event.block.number, oldBeanPrice, currentBeanPrice);

  setPoolReserves(event.address.toHexString(), reserves, event.block.timestamp, event.block.number);

  updateBeanSupplyPegPercent(event.block.number);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, currentBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD);
}

function updatePriceETH(): void {
  let token = loadOrCreateToken(WETH.toHexString());
  token.lastPriceUSD = getPriceETH();
  token.save();
}

function getPriceETH(): BigDecimal {
  let pair = UniswapV2Pair.bind(WETH_USDC_PAIR);
  let reserves = pair.getReserves();
  // Token 0 is USDC and Token 1 is WETH
  return toDecimal(reserves.value0).div(toDecimal(reserves.value1, 18));
}

export function checkPegCrossEth(block: ethereum.Block): void {
  const pool = loadOrCreatePool(BEAN_WETH_V1.toHexString(), block.number);
  const prevPrice = pool.lastPrice;

  const reserves = uniswapV2Reserves(BEAN_WETH_V1);
  const ethPrice = getPriceETH();
  const newPrice = uniswapV2Price(toDecimal(reserves[0]), toDecimal(reserves[1], 18), ethPrice);

  // log.debug("Prev/New bean price {} / {}", [prevPrice.toString(), newPrice.toString()]);

  // Check for pool peg cross
  const poolCrossed = checkPoolCross(BEAN_WETH_V1.toHexString(), block.timestamp, block.number, prevPrice, newPrice);

  if (poolCrossed) {
    // Update price for the pool
    // updatePoolValues(
    //   BEAN_WETH_V1.toHexString(),
    //   block.timestamp,
    //   block.number,
    //   ZERO_BI,
    //   ZERO_BD,
    //   toDecimal(poolPriceInfo.liquidity).minus(pool.liquidityUSD),
    //   poolPriceInfo.deltaB
    // );
    // updatePoolPrice(poolPriceInfo.pool.toHexString(), block.timestamp, block.number, toDecimal(poolPriceInfo.price), false);
  }

  // TODO: if crossed, update weth token price
}
