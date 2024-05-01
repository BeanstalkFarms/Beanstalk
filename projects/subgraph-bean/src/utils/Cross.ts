import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BeanCross, PoolCross } from "../../generated/schema";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "./Bean";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ONE_BD, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadOrCreatePool, loadOrCreatePoolDailySnapshot, loadOrCreatePoolHourlySnapshot } from "./Pool";
import { BEAN_ERC20_V1 } from "../../../subgraph-core/utils/Constants";

export function loadOrCreateBeanCross(id: i32, bean: string, blockNumber: BigInt, timestamp: BigInt): BeanCross {
  let cross = BeanCross.load(id.toString());
  if (cross == null) {
    let hour = hourFromTimestamp(timestamp).toString();
    let day = dayFromTimestamp(timestamp).toString();
    cross = new BeanCross(id.toString());
    cross.bean = bean;
    cross.price = ZERO_BD;
    cross.blockNumber = blockNumber;
    cross.timestamp = timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.hourlySnapshot = hour;
    cross.dailySnapshot = day;
    cross.save();
  }
  return cross as BeanCross;
}

export function loadOrCreatePoolCross(id: i32, pool: string, blockNumber: BigInt, timestamp: BigInt): PoolCross {
  let crossID = pool + "-" + id.toString();
  let cross = PoolCross.load(crossID);
  if (cross == null) {
    let hour = hourFromTimestamp(timestamp).toString();
    let day = dayFromTimestamp(timestamp).toString();
    cross = new PoolCross(crossID);
    cross.pool = pool;
    cross.price = ZERO_BD;
    cross.blockNumber = blockNumber;
    cross.timestamp = timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.hourlySnapshot = hour;
    cross.dailySnapshot = day;
    cross.save();
  }
  return cross as PoolCross;
}

export function checkPoolCross(pool: string, timestamp: BigInt, blockNumber: BigInt, oldPrice: BigDecimal, newPrice: BigDecimal): boolean {
  let poolInfo = loadOrCreatePool(pool, blockNumber);
  let token = poolInfo.bean;
  let bean = loadBean(token);

  // log.debug("Prev/New well price {} / {}", [oldPrice.toString(), newPrice.toString()]);

  if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
    let cross = loadOrCreatePoolCross(poolInfo.crosses, pool, blockNumber, timestamp);

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(poolInfo.lastCross);
    cross.above = false;
    cross.save();

    poolInfo.lastCross = timestamp;
    poolInfo.crosses += 1;
    poolInfo.save();

    let poolHourly = loadOrCreatePoolHourlySnapshot(pool, timestamp, BigInt.fromI32(bean.lastSeason));
    let poolDaily = loadOrCreatePoolDailySnapshot(pool, timestamp, blockNumber);

    poolHourly.crosses += 1;
    poolHourly.deltaCrosses += 1;
    poolHourly.save();

    poolDaily.crosses += 1;
    poolDaily.deltaCrosses += 1;
    poolDaily.save();
    return true;
  } else if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
    let cross = loadOrCreatePoolCross(poolInfo.crosses, pool, blockNumber, timestamp);

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(poolInfo.lastCross);
    cross.above = true;
    cross.save();

    poolInfo.lastCross = timestamp;
    poolInfo.crosses += 1;
    poolInfo.save();

    let poolHourly = loadOrCreatePoolHourlySnapshot(pool, timestamp, BigInt.fromI32(bean.lastSeason));
    let poolDaily = loadOrCreatePoolDailySnapshot(pool, timestamp, blockNumber);

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

export function checkBeanCross(token: string, timestamp: BigInt, blockNumber: BigInt, oldPrice: BigDecimal, newPrice: BigDecimal): boolean {
  let bean = loadBean(token);

  if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
    let cross = loadOrCreateBeanCross(bean.crosses, token, blockNumber, timestamp);

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross);
    cross.above = false;
    cross.save();

    bean.lastCross = timestamp;
    bean.crosses += 1;
    bean.save();

    let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
    let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

    beanHourly.crosses += 1;
    beanHourly.deltaCrosses += 1;
    beanHourly.save();

    beanDaily.crosses += 1;
    beanDaily.deltaCrosses += 1;
    beanDaily.save();
    return true;
  } else if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
    let cross = loadOrCreateBeanCross(bean.crosses, token, blockNumber, timestamp);

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross);
    cross.above = true;
    cross.save();

    bean.lastCross = timestamp;
    bean.crosses += 1;
    bean.save();

    let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
    let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

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
  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  return bean.crosses;
}
