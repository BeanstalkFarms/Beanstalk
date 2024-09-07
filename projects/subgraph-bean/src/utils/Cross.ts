import { BigDecimal, Address, ethereum, log } from "@graphprotocol/graph-ts";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BEAN_ERC20_V1 } from "../../../subgraph-core/constants/BeanstalkEth";
import { loadOrCreatePool, loadOrCreatePoolDailySnapshot, loadOrCreatePoolHourlySnapshot } from "../entities/Pool";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "../entities/Bean";
import { loadOrCreateBeanCross, loadOrCreatePoolCross } from "../entities/Cross";
import { BeanstalkPrice_try_price } from "./price/BeanstalkPrice";
import { updatePoolPrice, updatePoolValues } from "./Pool";
import { updateBeanValues } from "./Bean";
import { getProtocolToken } from "./constants/Addresses";

export function checkPoolCross(pool: Address, oldPrice: BigDecimal, newPrice: BigDecimal, block: ethereum.Block): boolean {
  let poolInfo = loadOrCreatePool(pool, block.number);

  if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
    let cross = loadOrCreatePoolCross(poolInfo.crosses, pool, block);

    cross.price = newPrice;
    cross.timeSinceLastCross = block.timestamp.minus(poolInfo.lastCross);
    cross.above = false;
    cross.save();

    poolInfo.lastCross = block.timestamp;
    poolInfo.crosses += 1;
    poolInfo.save();

    let poolHourly = loadOrCreatePoolHourlySnapshot(pool, block);
    let poolDaily = loadOrCreatePoolDailySnapshot(pool, block);

    poolHourly.crosses += 1;
    poolHourly.deltaCrosses += 1;
    poolHourly.save();

    poolDaily.crosses += 1;
    poolDaily.deltaCrosses += 1;
    poolDaily.save();
    return true;
  } else if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
    let cross = loadOrCreatePoolCross(poolInfo.crosses, pool, block);

    cross.price = newPrice;
    cross.timeSinceLastCross = block.timestamp.minus(poolInfo.lastCross);
    cross.above = true;
    cross.save();

    poolInfo.lastCross = block.timestamp;
    poolInfo.crosses += 1;
    poolInfo.save();

    let poolHourly = loadOrCreatePoolHourlySnapshot(pool, block);
    let poolDaily = loadOrCreatePoolDailySnapshot(pool, block);

    poolHourly.crosses += 1;
    poolHourly.deltaCrosses += 1;
    poolHourly.save();

    poolDaily.crosses += 1;
    poolDaily.deltaCrosses += 1;
    poolDaily.save();
    return true;
  }
  return false;
}

export function checkBeanCross(token: Address, oldPrice: BigDecimal, newPrice: BigDecimal, block: ethereum.Block): boolean {
  let bean = loadBean(token);

  if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
    let cross = loadOrCreateBeanCross(bean.crosses, token, block);

    cross.price = newPrice;
    cross.timeSinceLastCross = block.timestamp.minus(bean.lastCross);
    cross.above = false;
    cross.save();

    bean.lastCross = block.timestamp;
    bean.crosses += 1;
    bean.save();

    let beanHourly = loadOrCreateBeanHourlySnapshot(token, block.timestamp, bean.lastSeason);
    let beanDaily = loadOrCreateBeanDailySnapshot(token, block.timestamp);

    beanHourly.crosses += 1;
    beanHourly.deltaCrosses += 1;
    beanHourly.save();

    beanDaily.crosses += 1;
    beanDaily.deltaCrosses += 1;
    beanDaily.save();
    return true;
  } else if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
    let cross = loadOrCreateBeanCross(bean.crosses, token, block);

    cross.price = newPrice;
    cross.timeSinceLastCross = block.timestamp.minus(bean.lastCross);
    cross.above = true;
    cross.save();

    bean.lastCross = block.timestamp;
    bean.crosses += 1;
    bean.save();

    let beanHourly = loadOrCreateBeanHourlySnapshot(token, block.timestamp, bean.lastSeason);
    let beanDaily = loadOrCreateBeanDailySnapshot(token, block.timestamp);

    beanHourly.crosses += 1;
    beanHourly.deltaCrosses += 1;
    beanHourly.save();

    beanDaily.crosses += 1;
    beanDaily.deltaCrosses += 1;
    beanDaily.save();
    return true;
  }
  return false;
}

export function getV1Crosses(): i32 {
  let bean = loadBean(BEAN_ERC20_V1);
  return bean.crosses;
}

/**
 * Using the BeanstalkPrice contract, updates pool prices and checks for peg crosses
 * @param priceOnlyOnCross - true if the pool price should only be updated on a peg cross
 * @param block
 * @returns false if the price contract reverted
 */
export function updatePoolPricesOnCross(priceOnlyOnCross: boolean, block: ethereum.Block): boolean {
  const priceResult = BeanstalkPrice_try_price(block.number);
  if (priceResult.reverted) {
    // Price contract was unavailable briefly after well deployment
    return false;
  }
  const beanToken = getProtocolToken(block.number);
  const bean = loadBean(beanToken);
  const prevPrice = bean.price;
  const newPrice = toDecimal(priceResult.value.price);

  // Check for overall peg cross
  const beanCrossed = checkBeanCross(beanToken, prevPrice, newPrice, block);

  // Update pool price for each pool - necessary for checking pool cross
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < priceResult.value.ps.length; ++i) {
    const poolPriceInfo = priceResult.value.ps[i];
    const pool = loadOrCreatePool(poolPriceInfo.pool, block.number);

    const poolCrossed = checkPoolCross(poolPriceInfo.pool, pool.lastPrice, toDecimal(poolPriceInfo.price), block);

    if (!priceOnlyOnCross || poolCrossed || beanCrossed) {
      totalLiquidity = totalLiquidity.plus(toDecimal(poolPriceInfo.liquidity));
      updatePoolValues(
        poolPriceInfo.pool,
        ZERO_BI,
        ZERO_BD,
        toDecimal(poolPriceInfo.liquidity).minus(pool.liquidityUSD),
        poolPriceInfo.deltaB,
        block
      );
      updatePoolPrice(poolPriceInfo.pool, toDecimal(poolPriceInfo.price), block, false);
    }
  }

  // Update bean values at the end now that the summation of pool liquidity is known
  if (!priceOnlyOnCross || beanCrossed) {
    updateBeanValues(beanToken, newPrice, ZERO_BI, ZERO_BI, ZERO_BD, totalLiquidity.minus(bean.liquidityUSD), block);
  }
  return true;
}
