import { ethereum } from "@graphprotocol/graph-ts";
import { checkPegCrossEth as univ2_checkPegCrossEth } from "./legacy/LegacyUniswapV2Handler";
import { PEG_CROSS_BLOCKS, PEG_CROSS_BLOCKS_LAST } from "../../cache-builder/results/PegCrossBlocks_eth";
import { BEAN_ERC20, BEAN_WETH_CP2_WELL_BLOCK, EXPLOIT_BLOCK } from "../../../subgraph-core/utils/Constants";
import { u32_binarySearchIndex } from "../../../subgraph-core/utils/Math";
import { BeanstalkPrice_try_price } from "../utils/price/BeanstalkPrice";
import { loadBean } from "../entities/Bean";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { checkBeanCross, checkPoolCross } from "../utils/Cross";
import { loadOrCreatePool } from "../entities/Pool";
import { updatePoolPrice, updatePoolValues } from "../utils/Pool";
import { updateBeanValues } from "../utils/Bean";

// Processing as each new ethereum block is created
export function handleBlock(block: ethereum.Block): void {
  // Avoid checking for peg crosses on blocks which are already known to not have any cross.
  // The underlying methods do not write any data unless there is a cross
  if (block.number.toU32() > PEG_CROSS_BLOCKS_LAST || u32_binarySearchIndex(PEG_CROSS_BLOCKS, block.number.toU32()) != -1) {
    if (block.number < EXPLOIT_BLOCK) {
      univ2_checkPegCrossEth(block);
    } else if (block.number >= BEAN_WETH_CP2_WELL_BLOCK) {
      beanstalkPrice_updatePoolPrices(true, block);
    }
  }
}

/**
 * Using the BeanstalkPrice contract, updates pool prices and checks for peg crosses
 * @param priceOnlyOnCross - true if the pool price should only be updated on a peg cross
 * @param block
 * @returns false if the price contract reverted
 */
export function beanstalkPrice_updatePoolPrices(priceOnlyOnCross: boolean, block: ethereum.Block): boolean {
  const priceResult = BeanstalkPrice_try_price(BEAN_ERC20, block.number);
  if (priceResult.reverted) {
    // Price contract was unavailable briefly after well deployment
    return false;
  }
  const bean = loadBean(BEAN_ERC20.toHexString());
  const prevPrice = bean.price;
  const newPrice = toDecimal(priceResult.value.price);

  // Check for overall peg cross
  const beanCrossed = checkBeanCross(BEAN_ERC20.toHexString(), prevPrice, newPrice, block);

  // Update pool price for each pool - necessary for checking pool cross
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < priceResult.value.ps.length; ++i) {
    const poolPriceInfo = priceResult.value.ps[i];
    const pool = loadOrCreatePool(poolPriceInfo.pool.toHexString(), block.number);

    const poolCrossed = checkPoolCross(poolPriceInfo.pool.toHexString(), pool.lastPrice, toDecimal(poolPriceInfo.price), block);

    if (!priceOnlyOnCross || poolCrossed || beanCrossed) {
      totalLiquidity = totalLiquidity.plus(toDecimal(poolPriceInfo.liquidity));
      updatePoolValues(
        poolPriceInfo.pool.toHexString(),
        ZERO_BI,
        ZERO_BD,
        toDecimal(poolPriceInfo.liquidity).minus(pool.liquidityUSD),
        poolPriceInfo.deltaB,
        block
      );
      updatePoolPrice(poolPriceInfo.pool.toHexString(), toDecimal(poolPriceInfo.price), block, false);
    }
  }

  // Update bean values at the end now that the summation of pool liquidity is known
  if (!priceOnlyOnCross || beanCrossed) {
    updateBeanValues(BEAN_ERC20.toHexString(), newPrice, ZERO_BI, ZERO_BI, ZERO_BD, totalLiquidity.minus(bean.liquidityUSD), block);
  }
  return true;
}
