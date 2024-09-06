import { ethereum } from "@graphprotocol/graph-ts";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BeanCross, PoolCross } from "../../generated/schema";

export function loadOrCreateBeanCross(id: i32, bean: string, block: ethereum.Block): BeanCross {
  let cross = BeanCross.load(id.toString());
  if (cross == null) {
    let hour = hourFromTimestamp(block.timestamp).toString();
    let day = dayFromTimestamp(block.timestamp).toString();
    cross = new BeanCross(id.toString());
    cross.bean = bean;
    cross.price = ZERO_BD;
    cross.blockNumber = block.number;
    cross.timestamp = block.timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.hourlySnapshot = hour;
    cross.dailySnapshot = day;
    cross.save();
  }
  return cross as BeanCross;
}

export function loadOrCreatePoolCross(id: i32, pool: string, block: ethereum.Block): PoolCross {
  let crossID = pool + "-" + id.toString();
  let cross = PoolCross.load(crossID);
  if (cross == null) {
    let hour = hourFromTimestamp(block.timestamp).toString();
    let day = dayFromTimestamp(block.timestamp).toString();
    cross = new PoolCross(crossID);
    cross.pool = pool;
    cross.price = ZERO_BD;
    cross.blockNumber = block.number;
    cross.timestamp = block.timestamp;
    cross.timeSinceLastCross = ZERO_BI;
    cross.above = false;
    cross.hourlySnapshot = hour;
    cross.dailySnapshot = day;
    cross.save();
  }
  return cross as PoolCross;
}
