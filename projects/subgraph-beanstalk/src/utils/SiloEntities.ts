import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Silo,
  SiloHourlySnapshot,
  SiloDailySnapshot,
  SiloDeposit,
  SiloWithdraw,
  SiloYield,
  SiloAssetDailySnapshot,
  SiloAssetHourlySnapshot,
  SiloAsset,
  WhitelistTokenSetting,
  WhitelistTokenHourlySnapshot,
  WhitelistTokenDailySnapshot,
  TokenYield
} from "../../generated/schema";
import { BEANSTALK, UNRIPE_BEAN, UNRIPE_BEAN_3CRV } from "../../../subgraph-core/utils/Constants";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadBeanstalk } from "./Beanstalk";

/* ===== Base Silo Entities ===== */

export function loadSilo(account: Address): Silo {
  let silo = Silo.load(account.toHexString());
  if (silo == null) {
    silo = new Silo(account.toHexString());
    silo.beanstalk = BEANSTALK.toHexString();
    if (account !== BEANSTALK) {
      silo.farmer = account.toHexString();
    }
    silo.whitelistedTokens = [];
    silo.dewhitelistedTokens = [];
    silo.depositedBDV = ZERO_BI;
    silo.stalk = ZERO_BI;
    silo.plantableStalk = ZERO_BI;
    silo.seeds = ZERO_BI;
    silo.grownStalkPerSeason = ZERO_BI;
    silo.roots = ZERO_BI;
    silo.germinatingStalk = ZERO_BI;
    silo.beanMints = ZERO_BI;
    silo.activeFarmers = 0;
    silo.save();
  }
  return silo as Silo;
}

export function loadSiloHourlySnapshot(account: Address, season: i32, timestamp: BigInt): SiloHourlySnapshot {
  let id = account.toHexString() + "-" + season.toString();
  let snapshot = SiloHourlySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new SiloHourlySnapshot(id);
    let silo = loadSilo(account);
    snapshot.season = season;
    snapshot.silo = account.toHexString();
    snapshot.depositedBDV = silo.depositedBDV;
    snapshot.stalk = silo.stalk;
    snapshot.plantableStalk = silo.plantableStalk;
    snapshot.seeds = silo.seeds;
    snapshot.grownStalkPerSeason = silo.grownStalkPerSeason;
    snapshot.roots = silo.roots;
    snapshot.germinatingStalk = silo.germinatingStalk;
    snapshot.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
    snapshot.beanMints = silo.beanMints;
    snapshot.activeFarmers = silo.activeFarmers;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaStalk = ZERO_BI;
    snapshot.deltaPlantableStalk = ZERO_BI;
    snapshot.deltaSeeds = ZERO_BI;
    snapshot.deltaRoots = ZERO_BI;
    snapshot.deltaGerminatingStalk = ZERO_BI;
    snapshot.deltaBeanMints = ZERO_BI;
    snapshot.deltaActiveFarmers = 0;
    snapshot.createdAt = BigInt.fromString(hourFromTimestamp(timestamp));
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as SiloHourlySnapshot;
}

export function loadSiloDailySnapshot(account: Address, timestamp: BigInt): SiloDailySnapshot {
  let day = dayFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + day.toString();
  let snapshot = SiloDailySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new SiloDailySnapshot(id);
    let silo = loadSilo(account);
    snapshot.season = 0;
    snapshot.silo = account.toHexString();
    snapshot.depositedBDV = silo.depositedBDV;
    snapshot.stalk = silo.stalk;
    snapshot.plantableStalk = silo.plantableStalk;
    snapshot.seeds = silo.seeds;
    snapshot.grownStalkPerSeason = silo.grownStalkPerSeason;
    snapshot.roots = silo.roots;
    snapshot.germinatingStalk = silo.germinatingStalk;
    snapshot.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
    snapshot.beanMints = silo.beanMints;
    snapshot.activeFarmers = silo.activeFarmers;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaStalk = ZERO_BI;
    snapshot.deltaPlantableStalk = ZERO_BI;
    snapshot.deltaSeeds = ZERO_BI;
    snapshot.deltaRoots = ZERO_BI;
    snapshot.deltaGerminatingStalk = ZERO_BI;
    snapshot.deltaBeanMints = ZERO_BI;
    snapshot.deltaActiveFarmers = 0;
    snapshot.createdAt = BigInt.fromString(day);
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as SiloDailySnapshot;
}

/* ===== Asset Entities ===== */

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

/* ===== Whitelist Token Settings Entities ===== */

export function loadWhitelistTokenSetting(token: Address): WhitelistTokenSetting {
  let setting = WhitelistTokenSetting.load(token);
  if (setting == null) {
    setting = new WhitelistTokenSetting(token);
    setting.selector = Bytes.empty();
    setting.stalkEarnedPerSeason = ZERO_BI;
    setting.stalkIssuedPerBdv = ZERO_BI;
    setting.milestoneSeason = 0;
    setting.updatedAt = ZERO_BI;
    setting.save();

    // Check token addresses and set replant seeds/stalk for Unripe due to event timing.
    if (token == UNRIPE_BEAN) {
      setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
      setting.stalkEarnedPerSeason = BigInt.fromI32(2000000);
      setting.save();
    } else if (token == UNRIPE_BEAN_3CRV) {
      setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
      setting.stalkEarnedPerSeason = BigInt.fromI32(4000000);
      setting.save();
    }
  }
  return setting as WhitelistTokenSetting;
}

export function loadWhitelistTokenHourlySnapshot(token: Address, season: i32, timestamp: BigInt): WhitelistTokenHourlySnapshot {
  let hour = hourFromTimestamp(timestamp);
  let id = token.toHexString() + "-" + season.toString();
  let snapshot = WhitelistTokenHourlySnapshot.load(id);
  if (snapshot == null) {
    let setting = loadWhitelistTokenSetting(token);
    snapshot = new WhitelistTokenHourlySnapshot(id);
    snapshot.season = season;
    snapshot.token = setting.id;
    snapshot.selector = setting.selector;
    snapshot.gpSelector = setting.gpSelector;
    snapshot.lwSelector = setting.lwSelector;
    snapshot.stalkEarnedPerSeason = setting.stalkEarnedPerSeason;
    snapshot.stalkIssuedPerBdv = setting.stalkIssuedPerBdv;
    snapshot.milestoneSeason = setting.milestoneSeason;
    snapshot.gaugePoints = setting.gaugePoints;
    snapshot.optimalPercentDepositedBdv = setting.optimalPercentDepositedBdv;
    snapshot.createdAt = BigInt.fromString(hour);
    snapshot.updatedAt = ZERO_BI;
    snapshot.save();
  }
  return snapshot as WhitelistTokenHourlySnapshot;
}

export function loadWhitelistTokenDailySnapshot(token: Address, timestamp: BigInt): WhitelistTokenDailySnapshot {
  let day = dayFromTimestamp(timestamp);
  let id = token.toHexString() + "-" + day.toString();
  let snapshot = WhitelistTokenDailySnapshot.load(id);
  if (snapshot == null) {
    let setting = loadWhitelistTokenSetting(token);
    snapshot = new WhitelistTokenDailySnapshot(id);
    snapshot.token = setting.id;
    snapshot.selector = setting.selector;
    snapshot.gpSelector = setting.gpSelector;
    snapshot.lwSelector = setting.lwSelector;
    snapshot.stalkEarnedPerSeason = setting.stalkEarnedPerSeason;
    snapshot.stalkIssuedPerBdv = setting.stalkIssuedPerBdv;
    snapshot.milestoneSeason = setting.milestoneSeason;
    snapshot.gaugePoints = setting.gaugePoints;
    snapshot.optimalPercentDepositedBdv = setting.optimalPercentDepositedBdv;
    snapshot.createdAt = BigInt.fromString(day);
    snapshot.updatedAt = ZERO_BI;
    snapshot.save();
  }
  return snapshot as WhitelistTokenDailySnapshot;
}

/* ===== Deposit Entities ===== */

export function loadSiloDeposit(account: Address, token: Address, season: BigInt): SiloDeposit {
  let id = account.toHexString() + "-" + token.toHexString() + "-" + season.toString();
  let deposit = SiloDeposit.load(id);
  if (deposit == null) {
    deposit = new SiloDeposit(id);
    deposit.farmer = account.toHexString();
    deposit.token = token.toHexString();
    deposit.season = season.toI32();
    deposit.amount = ZERO_BI;
    deposit.depositedAmount = ZERO_BI;
    deposit.withdrawnAmount = ZERO_BI;
    deposit.bdv = ZERO_BI;
    deposit.depositedBDV = ZERO_BI;
    deposit.withdrawnBDV = ZERO_BI;
    deposit.hashes = [];
    deposit.createdAt = ZERO_BI;
    deposit.updatedAt = ZERO_BI;
    deposit.save();
  }
  return deposit;
}

export function loadSiloDepositV3(account: Address, token: Address, stem: BigInt): SiloDeposit {
  let id = account.toHexString() + "-" + token.toHexString() + "-" + stem.toString();
  let deposit = SiloDeposit.load(id);
  if (deposit == null) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    deposit = new SiloDeposit(id);
    deposit.farmer = account.toHexString();
    deposit.token = token.toHexString();
    deposit.season = beanstalk.lastSeason;
    deposit.stem = stem;
    deposit.amount = ZERO_BI;
    deposit.depositedAmount = ZERO_BI;
    deposit.withdrawnAmount = ZERO_BI;
    deposit.bdv = ZERO_BI;
    deposit.depositedBDV = ZERO_BI;
    deposit.withdrawnBDV = ZERO_BI;
    deposit.hashes = [];
    deposit.createdAt = ZERO_BI;
    deposit.updatedAt = ZERO_BI;
    deposit.save();
  }
  return deposit;
}

/* ===== Withdraw Entities ===== */

export function loadSiloWithdraw(account: Address, token: Address, season: i32): SiloWithdraw {
  let id = account.toHexString() + "-" + token.toHexString() + "-" + season.toString();
  let withdraw = SiloWithdraw.load(id);
  if (withdraw == null) {
    withdraw = new SiloWithdraw(id);
    withdraw.farmer = account.toHexString();
    withdraw.token = token.toHexString();
    withdraw.withdrawSeason = season;
    withdraw.claimableSeason = season + 1;
    withdraw.claimed = false;
    withdraw.amount = ZERO_BI;
    withdraw.hashes = [];
    withdraw.createdAt = ZERO_BI;
    withdraw.save();
  }
  return withdraw as SiloWithdraw;
}

/* ===== Yield Entities ===== */

export function loadSiloYield(season: i32, window: i32): SiloYield {
  let siloYield = SiloYield.load(season.toString() + "-" + window.toString());
  if (siloYield == null) {
    siloYield = new SiloYield(season.toString() + "-" + window.toString());
    siloYield.season = season;
    siloYield.beta = ZERO_BD;
    siloYield.u = 0;
    siloYield.beansPerSeasonEMA = ZERO_BD;
    siloYield.whitelistedTokens = [];
    siloYield.createdAt = ZERO_BI;

    if (window == 24) {
      siloYield.window = "ROLLING_24_HOUR";
    } else if (window == 168) {
      siloYield.window = "ROLLING_7_DAY";
    } else if (window == 720) {
      siloYield.window = "ROLLING_30_DAY";
    }
    siloYield.save();
  }
  return siloYield as SiloYield;
}

export function loadTokenYield(token: Address, season: i32, window: i32): TokenYield {
  let id = token.concatI32(season).concatI32(window);
  let tokenYield = TokenYield.load(id);
  if (tokenYield == null) {
    tokenYield = new TokenYield(id);
    tokenYield.token = token;
    tokenYield.season = season;
    tokenYield.siloYield = season.toString() + "-" + window.toString();
    tokenYield.beanAPY = ZERO_BD;
    tokenYield.stalkAPY = ZERO_BD;
    tokenYield.createdAt = ZERO_BI;
    tokenYield.save();
  }
  return tokenYield as TokenYield;
}

export function SiloAsset_findIndex_token(a: SiloAsset[], targetToken: string): i32 {
  for (let j = 0; j < a.length; j++) {
    if (a[j].token == targetToken) {
      return j;
    }
  }
  return -1;
}
