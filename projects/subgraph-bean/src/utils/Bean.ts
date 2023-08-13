import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Bean, BeanDailySnapshot, BeanHourlySnapshot } from "../../generated/schema";
import { BEAN_3CRV, BEAN_ERC20_V1, BEAN_ERC20, BEAN_WETH_V1, BEAN_WETH_CP2_WELL } from "../../../subgraph-core/utils/Constants";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getV1Crosses } from "./Cross";
import { loadOrCreatePool } from "./Pool";

export function loadBean(token: string): Bean {
  let bean = Bean.load(token);
  if (bean == null) {
    bean = new Bean(token);
    bean.supply = ZERO_BI;
    bean.marketCap = ZERO_BD;
    bean.supplyInPegLP = ZERO_BD;
    bean.volume = ZERO_BI;
    bean.volumeUSD = ZERO_BD;
    bean.liquidityUSD = ZERO_BD;
    bean.price = BigDecimal.fromString("1.072");
    bean.crosses = token == BEAN_ERC20.toHexString() ? getV1Crosses() : 0; // starting point for v2 is where v1 left off
    bean.lastCross = ZERO_BI;
    bean.lastSeason = token == BEAN_ERC20.toHexString() ? 6074 : 0;
    bean.pools = [];
    bean.save();
  }
  return bean as Bean;
}

export function loadOrCreateBeanHourlySnapshot(token: string, timestamp: BigInt, season: i32): BeanHourlySnapshot {
  let hour = hourFromTimestamp(timestamp);
  let id = token + "-" + season.toString();
  let snapshot = BeanHourlySnapshot.load(id);
  if (snapshot == null) {
    let bean = loadBean(token);
    snapshot = new BeanHourlySnapshot(id);
    snapshot.bean = bean.id;
    snapshot.supply = ZERO_BI;
    snapshot.marketCap = bean.marketCap;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.crosses = bean.crosses;
    snapshot.deltaBeans = ZERO_BI;
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
    snapshot.supply = ZERO_BI;
    snapshot.marketCap = bean.marketCap;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.crosses = bean.crosses;
    snapshot.deltaBeans = ZERO_BI;
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

export function updateBeanValues(
  token: string,
  timestamp: BigInt,
  newPrice: BigDecimal,
  deltaSupply: BigInt,
  deltaVolume: BigInt,
  deltaVolumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal
): void {
  let bean = loadBean(token);
  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

  bean.price = newPrice;
  bean.supply = bean.supply.plus(deltaSupply);
  bean.marketCap = toDecimal(bean.supply).times(bean.price);
  bean.volume = bean.volume.plus(deltaVolume);
  bean.volumeUSD = bean.volumeUSD.plus(deltaVolumeUSD);
  bean.liquidityUSD = bean.liquidityUSD.plus(deltaLiquidityUSD);
  bean.save();

  beanHourly.volume = bean.volume;
  beanHourly.volumeUSD = bean.volumeUSD;
  beanHourly.liquidityUSD = bean.liquidityUSD;
  beanHourly.price = bean.price;
  beanHourly.supply = bean.supply;
  beanHourly.marketCap = bean.marketCap;
  beanHourly.supplyInPegLP = bean.supplyInPegLP;
  beanHourly.deltaVolume = beanHourly.deltaVolume.plus(deltaVolume);
  beanHourly.deltaVolumeUSD = beanHourly.deltaVolumeUSD.plus(deltaVolumeUSD);
  beanHourly.deltaLiquidityUSD = beanHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  beanHourly.save();

  beanDaily.volume = bean.volume;
  beanDaily.volumeUSD = bean.volumeUSD;
  beanDaily.liquidityUSD = bean.liquidityUSD;
  beanDaily.price = bean.price;
  beanDaily.supply = bean.supply;
  beanDaily.marketCap = bean.marketCap;
  beanDaily.supplyInPegLP = bean.supplyInPegLP;
  beanDaily.deltaVolume = beanDaily.deltaVolume.plus(deltaVolume);
  beanDaily.deltaVolumeUSD = beanDaily.deltaVolumeUSD.plus(deltaVolumeUSD);
  beanDaily.deltaLiquidityUSD = beanDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  beanDaily.save();
}

export function updateBeanSeason(token: string, timestamp: BigInt, season: i32): void {
  let bean = loadBean(token);
  bean.lastSeason = season;
  bean.save();

  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, season);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

  beanHourly.season = season;
  beanHourly.save();

  beanDaily.season = season;
  beanDaily.save();
}

export function getBeanTokenAddress(blockNumber: BigInt): string {
  return blockNumber < BigInt.fromString("15278082") ? BEAN_ERC20_V1.toHexString() : BEAN_ERC20.toHexString();
}

export function updateBeanSupplyPegPercent(blockNumber: BigInt): void {
  if (blockNumber < BigInt.fromString("15278082")) {
    let pool = loadOrCreatePool(BEAN_WETH_V1.toHexString(), blockNumber);
    let bean = loadBean(BEAN_ERC20_V1.toHexString());

    bean.supplyInPegLP = toDecimal(pool.reserves[1]).div(toDecimal(bean.supply));
    bean.save();
  } else {
    let pegSupply = ZERO_BI;
    let pool = loadOrCreatePool(BEAN_3CRV.toHexString(), blockNumber);

    pegSupply = pegSupply.plus(pool.reserves[0]);

    // Add in Well beans post deploy
    if (blockNumber > BigInt.fromString("17200000")) {
      let well = loadOrCreatePool(BEAN_WETH_CP2_WELL.toHexString(), blockNumber);
      pegSupply = pegSupply.plus(well.reserves[0]);
    }

    let bean = loadBean(BEAN_ERC20.toHexString());

    bean.supplyInPegLP = toDecimal(pegSupply).div(toDecimal(bean.supply));
    bean.save();
  }
}
