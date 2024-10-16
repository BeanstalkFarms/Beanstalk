import { ethereum } from "@graphprotocol/graph-ts";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Bean, BeanCross, Pool, PoolCross } from "../../generated/schema";
import { loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "./Bean";
import { loadOrCreatePoolDailySnapshot, loadOrCreatePoolHourlySnapshot } from "./Pool";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

export function loadOrCreateBeanCross(bean: Bean, block: ethereum.Block): BeanCross {
  let crossID = bean.crosses.toString();
  let cross = BeanCross.load(crossID);
  if (cross == null) {
    cross = new BeanCross(crossID);
    cross.bean = bean.id;
    cross.price = ZERO_BD;
    cross.blockNumber = block.number;
    cross.timestamp = block.timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.beanHourlySnapshot = loadOrCreateBeanHourlySnapshot(bean, block).id;
    cross.beanDailySnapshot = loadOrCreateBeanDailySnapshot(bean, block).id;
    cross.save();
  }
  return cross as BeanCross;
}

export function loadOrCreatePoolCross(pool: Pool, block: ethereum.Block): PoolCross {
  let crossID = pool.id.toHexString() + "-" + pool.crosses.toString();
  let cross = PoolCross.load(crossID);
  if (cross == null) {
    cross = new PoolCross(crossID);
    cross.pool = pool.id;
    cross.price = ZERO_BD;
    cross.blockNumber = block.number;
    cross.timestamp = block.timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.poolHourlySnapshot = loadOrCreatePoolHourlySnapshot(toAddress(pool.id), block).id;
    cross.poolDailySnapshot = loadOrCreatePoolDailySnapshot(toAddress(pool.id), block).id;
    cross.save();
  }
  return cross as PoolCross;
}
