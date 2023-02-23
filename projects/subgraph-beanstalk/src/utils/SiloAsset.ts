import { Address, BigInt } from "@graphprotocol/graph-ts";
import { SiloAsset, SiloAssetHourlySnapshot, SiloAssetDailySnapshot } from "../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadSiloAsset(account: Address, token: Address): SiloAsset {
  let id = account.toHexString() + "-" + token.toHexString();
  let asset = SiloAsset.load(id);

  if (asset == null) {
    //let tokenEntity = loadToken(token)
    asset = new SiloAsset(id);
    asset.silo = account.toHexString();
    asset.token = token.toHexString();
    asset.depositedBDV = ZERO_BI;
    asset.depositedAmount = ZERO_BI;
    asset.withdrawnAmount = ZERO_BI;
    asset.farmAmount = ZERO_BI;
    asset.save();
  }
  return asset as SiloAsset;
}

export function loadSiloAssetHourlySnapshot(account: Address, token: Address, season: i32, timestamp: BigInt): SiloAssetHourlySnapshot {
  let hour = hourFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + token.toHexString() + "-" + season.toString();
  let snapshot = SiloAssetHourlySnapshot.load(id);
  if (snapshot == null) {
    let asset = loadSiloAsset(account, token);
    snapshot = new SiloAssetHourlySnapshot(id);
    snapshot.season = season;
    snapshot.siloAsset = asset.id;
    snapshot.depositedBDV = asset.depositedBDV;
    snapshot.depositedAmount = asset.depositedAmount;
    snapshot.withdrawnAmount = asset.withdrawnAmount;
    snapshot.farmAmount = asset.farmAmount;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaDepositedAmount = ZERO_BI;
    snapshot.deltaWithdrawnAmount = ZERO_BI;
    snapshot.deltaFarmAmount = ZERO_BI;
    snapshot.createdAt = BigInt.fromString(hour);
    snapshot.updatedAt = ZERO_BI;
    snapshot.save();
  }
  return snapshot as SiloAssetHourlySnapshot;
}

export function loadSiloAssetDailySnapshot(account: Address, token: Address, timestamp: BigInt): SiloAssetDailySnapshot {
  let day = dayFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + token.toHexString() + "-" + day.toString();
  let snapshot = SiloAssetDailySnapshot.load(id);
  if (snapshot == null) {
    let asset = loadSiloAsset(account, token);
    snapshot = new SiloAssetDailySnapshot(id);
    snapshot.season = 0;
    snapshot.siloAsset = asset.id;
    snapshot.depositedBDV = asset.depositedBDV;
    snapshot.depositedAmount = asset.depositedAmount;
    snapshot.withdrawnAmount = asset.withdrawnAmount;
    snapshot.farmAmount = asset.farmAmount;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaDepositedAmount = ZERO_BI;
    snapshot.deltaWithdrawnAmount = ZERO_BI;
    snapshot.deltaFarmAmount = ZERO_BI;
    snapshot.createdAt = BigInt.fromString(day);
    snapshot.updatedAt = ZERO_BI;
    snapshot.save();
  }
  return snapshot as SiloAssetDailySnapshot;
}
