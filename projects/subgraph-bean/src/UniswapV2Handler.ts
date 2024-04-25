import { BigDecimal, BigInt, ethereum, Address, log } from "@graphprotocol/graph-ts";
import { Swap, Sync } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { getLastBeanPrice, calcLiquidityWeightedBeanPrice, loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, BEAN_WETH_V1, WETH } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";
import { checkBeanCross, checkPoolCross } from "./utils/Cross";
import {
  getPreReplantPriceETH,
  uniswapV2DeltaB,
  constantProductPrice,
  uniswapV2Reserves,
  updatePreReplantPriceETH,
  calcUniswapV2Inst_2
} from "./utils/price/UniswapPrice";

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

  const newBeanPrice = calcLiquidityWeightedBeanPrice(BEAN_ERC20_V1.toHexString());
  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, newBeanPrice, ZERO_BI, ZERO_BI, usdVolume, ZERO_BD);
}

// Sync is called in UniswapV2 on any liquidity or swap transaction.
// It updates the `reserves` value on the contract.

export function handleSync(event: Sync): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  const oldBeanPrice = getLastBeanPrice(BEAN_ERC20_V1.toHexString());

  // Token 0 is WETH and Token 1 is BEAN
  let reserves = uniswapV2Reserves(event.address);

  let weth = updatePreReplantPriceETH();

  const weth_bd = toDecimal(reserves[0], 18);
  const bean_bd = toDecimal(reserves[1]);

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);
  let startLiquidityUSD = pool.liquidityUSD;
  let endLiquidityUSD = weth_bd.times(weth.lastPriceUSD).times(BigDecimal.fromString("2"));
  let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD);
  let deltaBeans = uniswapV2DeltaB(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, deltaBeans);

  let newPoolPrice = constantProductPrice(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, newPoolPrice);

  setPoolReserves(event.address.toHexString(), reserves, event.block.timestamp, event.block.number);

  updateBeanSupplyPegPercent(event.block.number);

  const newBeanPrice = calcLiquidityWeightedBeanPrice(BEAN_ERC20_V1.toHexString());
  checkBeanCross(BEAN_ERC20_V1.toHexString(), event.block.timestamp, event.block.number, oldBeanPrice, newBeanPrice);
  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, newBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD);
}

// Update pool price/liquidity/deltaB. This is for updating the price when another swap occurs and there is no peg
// cross in this pool. No need to check a peg cross again because the blockHandler will have already run before any events.
// The caller is expected to update overall bean prices after this function completes.
export function externalUpdatePoolPrice(poolAddr: Address, timestamp: BigInt, blockNumber: BigInt): void {
  const pool = loadOrCreatePool(poolAddr.toHexString(), blockNumber);

  const reserves = uniswapV2Reserves(poolAddr);
  const ethPrice = getPreReplantPriceETH();
  const newPoolPrices = calcUniswapV2Inst_2(toDecimal(reserves[1]), toDecimal(reserves[0], 18), ethPrice);
  const deltaLiquidityUSD = newPoolPrices.liquidity.minus(pool.liquidityUSD);

  updatePoolValues(BEAN_WETH_V1.toHexString(), timestamp, blockNumber, ZERO_BI, ZERO_BD, deltaLiquidityUSD, newPoolPrices.deltaB);
  updatePoolPrice(BEAN_WETH_V1.toHexString(), timestamp, blockNumber, newPoolPrices.price, false);
}

export function checkPegCrossEth(block: ethereum.Block): void {
  const pool = loadOrCreatePool(BEAN_WETH_V1.toHexString(), block.number);
  const prevPoolPrice = pool.lastPrice;

  const reserves = uniswapV2Reserves(BEAN_WETH_V1);
  const ethPrice = getPreReplantPriceETH();
  const newPoolPrices = calcUniswapV2Inst_2(toDecimal(reserves[1]), toDecimal(reserves[0], 18), ethPrice);

  // log.debug("Prev/New bean price {} / {}", [prevPrice.toString(), newPrice.toString()]);

  // Check for pool peg cross
  const poolCrossed = checkPoolCross(BEAN_WETH_V1.toHexString(), block.timestamp, block.number, prevPoolPrice, newPoolPrices.price);

  let deltaLiquidityUSD = ZERO_BD;
  if (poolCrossed) {
    // Update price for the pool
    deltaLiquidityUSD = newPoolPrices.liquidity.minus(pool.liquidityUSD);
    updatePoolValues(BEAN_WETH_V1.toHexString(), block.timestamp, block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, newPoolPrices.deltaB);
    updatePoolPrice(BEAN_WETH_V1.toHexString(), block.timestamp, block.number, newPoolPrices.price, false);

    // Update weth token price
    let token = loadOrCreateToken(WETH.toHexString());
    token.lastPriceUSD = ethPrice;
    token.save();
  }

  // Check for overall Bean cross
  const oldBeanPrice = getLastBeanPrice(BEAN_ERC20_V1.toHexString());
  const newBeanPrice = calcLiquidityWeightedBeanPrice(BEAN_ERC20_V1.toHexString());
  // log.info("old {} new bp {}", [oldBeanPrice.toString(), newBeanPrice.toString()]);
  const beanCrossed = checkBeanCross(BEAN_ERC20_V1.toHexString(), block.timestamp, block.number, oldBeanPrice, newBeanPrice);
  if (beanCrossed) {
    updateBeanValues(
      BEAN_ERC20_V1.toHexString(),
      block.timestamp,
      newBeanPrice,
      ZERO_BI,
      ZERO_BI,
      ZERO_BD,
      deltaLiquidityUSD // Assumption is that 3crv/lusd prices are constant
    );
  }
}
