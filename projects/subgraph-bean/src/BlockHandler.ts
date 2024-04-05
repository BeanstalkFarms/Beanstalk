import { ethereum, log } from "@graphprotocol/graph-ts";
import { BEANSTALK_PRICE, BEAN_ERC20 } from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI, toDecimal } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice } from "../generated/BeanWETHCP2w/BeanstalkPrice";
import { loadBean, updateBeanValues } from "./utils/Bean";
import { loadOrCreatePool, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { checkBeanCross, checkPoolCross } from "./utils/Cross";

// Processing as each new ethereum block is created
export function handleBlock(block: ethereum.Block): void {
  const beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  const priceResult = beanstalkPrice.try_price();
  const bean = loadBean(BEAN_ERC20.toHexString());
  const prevPrice = bean.price;
  const newPrice = toDecimal(priceResult.value.price);

  log.debug("Prev/New bean price {} / {}", [prevPrice.toString(), newPrice.toString()]);

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
