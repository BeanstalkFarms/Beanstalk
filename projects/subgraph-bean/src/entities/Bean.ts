import { ethereum, BigDecimal, Address } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { dayFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Bean, BeanDailySnapshot, BeanHourlySnapshot } from "../../generated/schema";
import { getV1Crosses } from "../utils/Cross";
import { loadOrCreateSeason } from "./Season";

export function loadBean(token: Address): Bean {
  let bean = Bean.load(token);
  if (bean == null) {
    bean = new Bean(token);
    bean.supply = ZERO_BI;
    bean.marketCap = ZERO_BD;
    bean.lockedBeans = ZERO_BI;
    bean.supplyInPegLP = ZERO_BD;
    bean.volume = ZERO_BI;
    bean.volumeUSD = ZERO_BD;
    bean.liquidityUSD = ZERO_BD;
    bean.price = BigDecimal.fromString("1.072");
    bean.crosses = token == BEAN_ERC20 ? getV1Crosses() : 0;
    bean.lastCross = ZERO_BI;
    bean.lastSeason = loadOrCreateSeason(token == BEAN_ERC20 ? 6074 : 0).id;
    bean.pools = [];
    bean.dewhitelistedPools = [];
    bean.save();
  }
  return bean as Bean;
}

export function loadOrCreateBeanHourlySnapshot(bean: Bean, block: ethereum.Block): BeanHourlySnapshot {
  let id = bean.id.toHexString() + "-" + bean.lastSeason;
  let snapshot = BeanHourlySnapshot.load(id);
  if (snapshot == null) {
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
    snapshot.timestamp = block.timestamp;
    snapshot.blockNumber = block.number;
    snapshot.save();
  }
  return snapshot as BeanHourlySnapshot;
}

export function loadOrCreateBeanDailySnapshot(bean: Bean, block: ethereum.Block): BeanDailySnapshot {
  let day = bean.id.toHexString() + "-" + dayFromTimestamp(block.timestamp).toString();
  let snapshot = BeanDailySnapshot.load(day);
  if (snapshot == null) {
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
    snapshot.timestamp = block.timestamp;
    snapshot.blockNumber = block.number;
    snapshot.save();
  }
  return snapshot as BeanDailySnapshot;
}
