import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Cross } from "../../generated/schema";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "./Bean";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ONE_BD, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { incrementPoolCross, loadOrCreatePool } from "./Pool";
import { BEAN_ERC20_V1 } from "../../../subgraph-core/utils/Constants";

export function loadOrCreateCross(id: i32, pool: string, timestamp: BigInt): Cross {
  let cross = Cross.load(id.toString());
  if (cross == null) {
    let hour = hourFromTimestamp(timestamp).toString();
    let day = dayFromTimestamp(timestamp).toString();
    cross = new Cross(id.toString());
    cross.pool = pool;
    cross.price = ZERO_BD;
    cross.timestamp = timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.overall = false;
    cross.hourlySnapshot = hour;
    cross.dailySnapshot = day;
    cross.poolHourlySnapshot = pool + "-" + hour;
    cross.poolDailySnapshot = pool + "-" + day;
    cross.save();
  }
  return cross as Cross;
}

export function checkCrossAndUpdate(
  pool: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  oldPrice: BigDecimal,
  newPrice: BigDecimal,
  beanOld: BigDecimal,
  beanNew: BigDecimal
): void {
  let poolInfo = loadOrCreatePool(pool, blockNumber);
  let token = poolInfo.bean;
  let bean = loadBean(token);
  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);
  let crossID = "";

  if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
    let cross = loadOrCreateCross(bean.crosses, pool, timestamp);
    crossID = cross.id;

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross);
    cross.above = false;
    cross.save();

    bean.crosses += 1;
    bean.save();

    beanHourly.crosses += 1;
    beanHourly.deltaCrosses += 1;
    beanHourly.save();

    beanDaily.crosses += 1;
    beanDaily.deltaCrosses += 1;
    beanDaily.save();

    incrementPoolCross(pool, timestamp, blockNumber);
  }

  if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
    let cross = loadOrCreateCross(bean.crosses, pool, timestamp);
    crossID = cross.id;

    cross.price = newPrice;
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross);
    cross.above = true;
    cross.save();

    bean.crosses += 1;
    bean.save();

    beanHourly.crosses += 1;
    beanHourly.deltaCrosses += 1;
    beanHourly.save();

    beanDaily.crosses += 1;
    beanDaily.deltaCrosses += 1;
    beanDaily.save();

    incrementPoolCross(pool, timestamp, blockNumber);
  }

  // We had a cross. Check if Bean crossed as well.
  if (crossID != "") {
    // Check cross logic against Bean values and not the pool values.
    if ((beanOld >= ONE_BD && beanNew < ONE_BD) || (beanOld < ONE_BD && beanNew >= ONE_BD)) {
      // This should never be null since we pulled the ID from the creation earlier.
      let cross = Cross.load(crossID);
      if (cross == null) return;
      bean.lastCross = timestamp;
      bean.save();

      cross.overall = true;
      cross.save();
    }
  }
}

export function getV1Crosses(): i32 {
  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  return bean.crosses;
}
