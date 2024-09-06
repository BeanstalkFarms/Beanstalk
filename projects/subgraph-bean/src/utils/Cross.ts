import { BigDecimal, Address, ethereum, log } from "@graphprotocol/graph-ts";
import { ONE_BD } from "../../../subgraph-core/utils/Decimals";
import { BEAN_ERC20_V1 } from "../../../subgraph-core/utils/Constants";
import { loadOrCreatePool, loadOrCreatePoolDailySnapshot, loadOrCreatePoolHourlySnapshot } from "../entities/Pool";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "../entities/Bean";
import { loadOrCreateBeanCross, loadOrCreatePoolCross } from "../entities/Cross";

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
