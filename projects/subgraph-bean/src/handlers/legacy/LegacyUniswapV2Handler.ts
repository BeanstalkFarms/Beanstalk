import { BigInt, ethereum, Address, log } from "@graphprotocol/graph-ts";
import { getLastBeanPrice, calcLiquidityWeightedBeanPrice, updateBeanSupplyPegPercent, updateBeanValues } from "../../utils/Bean";
import { Swap, Sync } from "../../../generated/Bean-ABIs/UniswapV2Pair";
import { loadOrCreateToken } from "../../entities/Token";
import { BEAN_ERC20_V1, BEAN_WETH_V1, WETH } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { loadOrCreatePool } from "../../entities/Pool";
import { setPoolReserves, updatePoolPrice, updatePoolValues } from "../../utils/Pool";
import { calcUniswapV2Inst_2, getPreReplantPriceETH, updatePreReplantPriceETH } from "../../utils/price/UniswapPrice";
import { checkBeanCross, checkPoolCross } from "../../utils/Cross";
import { updateTokenPrice } from "../../utils/Token";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";

// Reserves/price already updated by Sync event. Sync event is always emitted prior to a swap.
// Just update the volume for usd/bean
export function handleSwap(event: Swap): void {
  let weth = loadOrCreateToken(WETH);
  let usdVolume = toDecimal(event.params.amount0In.plus(event.params.amount0Out), 18).times(weth.lastPriceUSD);

  let pool = loadOrCreatePool(event.address, event.block.number);
  updatePoolValues(event.address, event.params.amount1In.plus(event.params.amount1Out), usdVolume, ZERO_BD, pool.deltaBeans, event.block);

  updateBeanValues(toAddress(pool.bean), null, ZERO_BI, ZERO_BI, usdVolume, ZERO_BD, event.block);
}

// Sync is called in UniswapV2 on any liquidity or swap transaction.
// It updates the `reserves` value on the contract.

export function handleSync(event: Sync): void {
  let pool = loadOrCreatePool(event.address, event.block.number);
  const beanAddress = toAddress(pool.bean);
  const oldBeanPrice = getLastBeanPrice(beanAddress);

  // Token 0 is WETH and Token 1 is BEAN
  let reserves = [event.params.reserve0, event.params.reserve1];

  let wethPrice = updatePreReplantPriceETH();

  const newPoolPrices = calcUniswapV2Inst_2(toDecimal(reserves[1]), toDecimal(reserves[0], 18), wethPrice);

  let deltaLiquidityUSD = newPoolPrices.liquidity.minus(pool.liquidityUSD);

  setPoolReserves(event.address, reserves, event.block);
  updatePoolValues(event.address, ZERO_BI, ZERO_BD, deltaLiquidityUSD, newPoolPrices.deltaB, event.block);
  updatePoolPrice(event.address, newPoolPrices.price, event.block);

  updateBeanSupplyPegPercent(beanAddress, event.block.number);

  const newBeanPrice = calcLiquidityWeightedBeanPrice(beanAddress);
  checkBeanCross(beanAddress, oldBeanPrice, newBeanPrice, event.block);
  updateBeanValues(beanAddress, newBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD, event.block);
}

// Update pool price/liquidity/deltaB. This is for updating the price when a swap occurs in another pool.
// The caller is expected to update overall bean prices after this function completes.
export function externalUpdatePoolPrice(poolAddr: Address, block: ethereum.Block): void {
  const pool = loadOrCreatePool(poolAddr, block.number);

  const ethPrice = updatePreReplantPriceETH();
  const newPoolPrices = calcUniswapV2Inst_2(toDecimal(pool.reserves[1]), toDecimal(pool.reserves[0], 18), ethPrice);
  const deltaLiquidityUSD = newPoolPrices.liquidity.minus(pool.liquidityUSD);

  updatePoolValues(poolAddr, ZERO_BI, ZERO_BD, deltaLiquidityUSD, newPoolPrices.deltaB, block);
  updatePoolPrice(poolAddr, newPoolPrices.price, block);
}

export function checkPegCrossEth(block: ethereum.Block): void {
  const poolAddrString = BEAN_WETH_V1;
  const pool = loadOrCreatePool(poolAddrString, block.number);
  const prevPoolPrice = pool.lastPrice;

  const reserves = pool.reserves;
  if (reserves[0] == ZERO_BI || reserves[1] == ZERO_BI) {
    return;
  }
  const ethPrice = getPreReplantPriceETH();
  const newPoolPrices = calcUniswapV2Inst_2(toDecimal(reserves[1]), toDecimal(reserves[0], 18), ethPrice);

  // Check for pool peg cross
  const poolCrossed = checkPoolCross(poolAddrString, prevPoolPrice, newPoolPrices.price, block);

  let deltaLiquidityUSD = ZERO_BD;
  if (poolCrossed) {
    // Update price for the pool
    deltaLiquidityUSD = newPoolPrices.liquidity.minus(pool.liquidityUSD);
    updatePoolValues(poolAddrString, ZERO_BI, ZERO_BD, deltaLiquidityUSD, newPoolPrices.deltaB, block);
    updatePoolPrice(poolAddrString, newPoolPrices.price, block, false);
  }

  // Check for overall Bean cross
  const oldBeanPrice = getLastBeanPrice(BEAN_ERC20_V1);
  const newBeanPrice = calcLiquidityWeightedBeanPrice(BEAN_ERC20_V1);
  const beanCrossed = checkBeanCross(BEAN_ERC20_V1, oldBeanPrice, newBeanPrice, block);
  if (beanCrossed) {
    updateBeanValues(
      toAddress(pool.bean),
      newBeanPrice,
      ZERO_BI,
      ZERO_BI,
      ZERO_BD,
      deltaLiquidityUSD, // Assumption is that 3crv/lusd prices are constant
      block
    );
  }

  if (poolCrossed || beanCrossed) {
    updateTokenPrice(WETH, ethPrice);
  }
}
