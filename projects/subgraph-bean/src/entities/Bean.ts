import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { BEAN_ERC20, BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { dayFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Bean, BeanDailySnapshot, BeanHourlySnapshot } from "../../generated/schema";
import { getV1Crosses } from "../utils/Cross";

export function loadBean(token: string): Bean {
  let bean = Bean.load(token);
  if (bean == null) {
    bean = new Bean(token);
    bean.chain = "ethereum";
    bean.beanstalk = BEANSTALK.toHexString();
    bean.supply = ZERO_BI;
    bean.marketCap = ZERO_BD;
    bean.lockedBeans = ZERO_BI;
    bean.supplyInPegLP = ZERO_BD;
    bean.volume = ZERO_BI;
    bean.volumeUSD = ZERO_BD;
    bean.liquidityUSD = ZERO_BD;
    bean.price = BigDecimal.fromString("1.072");
    bean.crosses = token == BEAN_ERC20.toHexString() ? getV1Crosses() : 0; // starting point for v2 is where v1 left off
    bean.lastCross = ZERO_BI;
    bean.lastSeason = token == BEAN_ERC20.toHexString() ? 6074 : 0;
    bean.pools = [];
    bean.dewhitelistedPools = [];
    bean.save();
  }
  return bean as Bean;
}

export function loadOrCreateBeanHourlySnapshot(token: string, timestamp: BigInt, season: i32): BeanHourlySnapshot {
  let id = token + "-" + season.toString();
  let snapshot = BeanHourlySnapshot.load(id);
  if (snapshot == null) {
    let bean = loadBean(token);
    snapshot = new BeanHourlySnapshot(id);
    snapshot.bean = bean.id;
    snapshot.supply = bean.supply;
    snapshot.marketCap = bean.marketCap;
    snapshot.lockedBeans = bean.lockedBeans;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.instantaneousDeltaB = ZERO_BI;
    snapshot.twaDeltaB = ZERO_BI;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.twaPrice = ZERO_BD;
    snapshot.crosses = bean.crosses;
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = bean.lastSeason;
    snapshot.timestamp = timestamp;
    snapshot.blockNumber = ZERO_BI;
    snapshot.save();
  }
  return snapshot as BeanHourlySnapshot;
}

export function loadOrCreateBeanDailySnapshot(token: string, timestamp: BigInt): BeanDailySnapshot {
  let day = dayFromTimestamp(timestamp).toString();
  let snapshot = BeanDailySnapshot.load(day);
  if (snapshot == null) {
    let bean = loadBean(token);
    snapshot = new BeanDailySnapshot(day);
    snapshot.bean = bean.id;
    snapshot.supply = bean.supply;
    snapshot.marketCap = bean.marketCap;
    snapshot.lockedBeans = bean.lockedBeans;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.instantaneousDeltaB = ZERO_BI;
    snapshot.twaDeltaB = ZERO_BI;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.twaPrice = ZERO_BD;
    snapshot.crosses = bean.crosses;
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = bean.lastSeason;
    snapshot.timestamp = timestamp;
    snapshot.blockNumber = ZERO_BI;
    snapshot.save();
  }
  return snapshot as BeanDailySnapshot;
}