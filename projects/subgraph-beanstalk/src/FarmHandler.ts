import { Address, BigInt } from "@graphprotocol/graph-ts";
import { InternalBalanceChanged } from "../generated/Farm/Beanstalk";
import { loadBeanstalk } from "./utils/Beanstalk";
import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import { loadSiloAsset, loadSiloAssetDailySnapshot, loadSiloAssetHourlySnapshot } from "./utils/SiloAsset";
import { loadFarmer } from "./utils/Farmer";

export function handleInternalBalanceChanged(event: InternalBalanceChanged): void {
  let beanstalk = loadBeanstalk(BEANSTALK);

  loadFarmer(event.params.user);

  updateFarmTotals(BEANSTALK, event.params.token, beanstalk.lastSeason, event.params.delta, event.block.timestamp);
  updateFarmTotals(event.params.user, event.params.token, beanstalk.lastSeason, event.params.delta, event.block.timestamp);
}

function updateFarmTotals(account: Address, token: Address, season: i32, delta: BigInt, timestamp: BigInt): void {
  let asset = loadSiloAsset(account, token);
  let assetHourly = loadSiloAssetHourlySnapshot(account, token, season, timestamp);
  let assetDaily = loadSiloAssetDailySnapshot(account, token, timestamp);

  asset.farmAmount = asset.farmAmount.plus(delta);
  asset.save();

  assetHourly.farmAmount = asset.farmAmount;
  assetHourly.deltaFarmAmount = assetHourly.deltaFarmAmount.plus(delta);
  assetHourly.updatedAt = timestamp;
  assetHourly.save();

  assetDaily.season = season;
  assetDaily.farmAmount = asset.farmAmount;
  assetDaily.deltaFarmAmount = assetDaily.deltaFarmAmount.plus(delta);
  assetDaily.updatedAt = timestamp;
  assetDaily.save();
}
