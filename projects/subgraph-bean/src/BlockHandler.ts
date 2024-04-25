import { ethereum } from "@graphprotocol/graph-ts";
import { BEAN_ERC20, BEAN_WETH_CP2_WELL_BLOCK, BEANSTALK_PRICE, EXPLOIT_BLOCK } from "../../subgraph-core/utils/Constants";
import { checkPegCrossEth as univ2_checkPegCrossEth } from "./UniswapV2Handler";
import { loadBean, updateBeanValues } from "./utils/Bean";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice } from "../generated/Bean3CRV/BeanstalkPrice";
import { checkBeanCross, checkPoolCross } from "./utils/Cross";
import { loadOrCreatePool, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { BeanstalkPrice_try_price } from "./utils/price/BeanstalkPrice";

// Processing as each new ethereum block is created
export function handleBlock(block: ethereum.Block): void {
  if (block.number < EXPLOIT_BLOCK) {
    univ2_checkPegCrossEth(block);
  } else if (block.number >= BEAN_WETH_CP2_WELL_BLOCK) {
    beanstalkPrice_checkPegCross(block);
  }
}

// Using the BeanstalkPrice contract, checks for peg crosses
function beanstalkPrice_checkPegCross(block: ethereum.Block): void {
  const priceResult = BeanstalkPrice_try_price(BEAN_ERC20, block.number);
  if (priceResult.reverted) {
    // Price contract was unavailable briefly after well deployment
    return;
  }
  const bean = loadBean(BEAN_ERC20.toHexString());
  const prevPrice = bean.price;
  const newPrice = toDecimal(priceResult.value.price);

  // log.debug("Prev/New bean price {} / {}", [prevPrice.toString(), newPrice.toString()]);

  // Check for overall peg cross
  const beanCrossed = checkBeanCross(BEAN_ERC20.toHexString(), block.timestamp, block.number, prevPrice, newPrice);

  // Update pool price for each pool - necessary for checking pool cross
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < priceResult.value.ps.length; ++i) {
    const poolPriceInfo = priceResult.value.ps[i];
    const pool = loadOrCreatePool(poolPriceInfo.pool.toHexString(), block.number);

    const poolCrossed = checkPoolCross(
      poolPriceInfo.pool.toHexString(),
      block.timestamp,
      block.number,
      pool.lastPrice,
      toDecimal(poolPriceInfo.price)
    );

    if (poolCrossed || beanCrossed) {
      totalLiquidity = totalLiquidity.plus(toDecimal(poolPriceInfo.liquidity));
      updatePoolValues(
        poolPriceInfo.pool.toHexString(),
        block.timestamp,
        block.number,
        ZERO_BI,
        ZERO_BD,
        toDecimal(poolPriceInfo.liquidity).minus(pool.liquidityUSD),
        poolPriceInfo.deltaB
      );
      updatePoolPrice(poolPriceInfo.pool.toHexString(), block.timestamp, block.number, toDecimal(poolPriceInfo.price), false);
    }
  }

  // Update bean values at the end now that the summation of pool liquidity is known
  if (beanCrossed) {
    updateBeanValues(
      BEAN_ERC20.toHexString(),
      block.timestamp,
      newPrice,
      ZERO_BI,
      ZERO_BI,
      ZERO_BD,
      totalLiquidity.minus(bean.liquidityUSD)
    );
  }
}
