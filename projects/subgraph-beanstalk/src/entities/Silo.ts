import { Address, BigInt, Bytes, ethereum, store, log } from "@graphprotocol/graph-ts";
import {
  Silo,
  SiloDeposit,
  SiloWithdraw,
  SiloYield,
  SiloAsset,
  WhitelistTokenSetting,
  TokenYield,
  UnripeToken
} from "../../generated/schema";
import { BEANSTALK, UNRIPE_BEAN, UNRIPE_LP } from "../../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getUnripeUnderlying } from "../utils/Constants";

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

/* ===== Asset Entities ===== */

export function loadSiloAsset(account: Address, token: Address): SiloAsset {
  let id = account.toHexString() + "-" + token.toHexString();
  let asset = SiloAsset.load(id);

  if (asset == null) {
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

/* ===== Whitelist Token Settings Entities ===== */

export function addToSiloWhitelist(siloAddress: Address, token: Address): void {
  let silo = loadSilo(siloAddress);
  let currentList = silo.whitelistedTokens;
  currentList.push(token.toHexString());
  silo.whitelistedTokens = currentList;
  silo.save();
}

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
    } else if (token == UNRIPE_LP) {
      setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
      setting.stalkEarnedPerSeason = BigInt.fromI32(4000000);
      setting.save();
    }
  }
  return setting as WhitelistTokenSetting;
}

/* ===== Unripe Entities ===== */

export function loadUnripeToken(token: Address): UnripeToken {
  let unripe = UnripeToken.load(token);
  if (unripe == null) {
    unripe = new UnripeToken(token);
    unripe.underlyingToken = getUnripeUnderlying(token, ZERO_BI).toHexString();
    unripe.totalUnderlying = ZERO_BI;
    unripe.amountUnderlyingOne = ZERO_BI;
    unripe.bdvUnderlyingOne = ZERO_BI;
    unripe.choppableAmountOne = ZERO_BI;
    unripe.choppableBdvOne = ZERO_BI;
    unripe.chopRate = ZERO_BD;
    unripe.recapPercent = ZERO_BD;
    unripe.totalChoppedAmount = ZERO_BI;
    unripe.totalChoppedBdv = ZERO_BI;
    unripe.totalChoppedBdvReceived = ZERO_BI;
    unripe.save();
  }
  return unripe as UnripeToken;
}

/* ===== Deposit Entities ===== */

class SiloDepositID {
  account: Address;
  token: Address;
  depositVersion: String;
  season: BigInt | null;
  stem: BigInt | null;
}

export function loadSiloDeposit(depositId: SiloDepositID): SiloDeposit {
  // id: Account - Token Address - Deposit Version - (Season|Stem)
  const seasonOrStem = depositId.depositVersion == "season" ? depositId.season! : depositId.stem!;
  const id =
    depositId.account.toHexString() + "-" + depositId.token.toHexString() + "-" + depositId.depositVersion + "-" + seasonOrStem.toString();
  let deposit = SiloDeposit.load(id);
  if (deposit == null) {
    deposit = new SiloDeposit(id);
    deposit.farmer = depositId.account.toHexString();
    deposit.token = depositId.token.toHexString();
    deposit.depositVersion = depositId.depositVersion.toString();
    if (depositId.season !== null) {
      deposit.season = depositId.season!.toU32();
    }
    deposit.stem = depositId.stem;
    deposit.stemV31 = ZERO_BI;
    deposit.depositedAmount = ZERO_BI;
    deposit.depositedBDV = ZERO_BI;
    deposit.hashes = [];
    deposit.createdBlock = ZERO_BI;
    deposit.updatedBlock = ZERO_BI;
    deposit.createdAt = ZERO_BI;
    deposit.updatedAt = ZERO_BI;
    deposit.save();
  }
  return deposit;
}

// Updates the given SiloDeposit with new amounts/bdv. If the deposit was fully withdrawn, delete the SiloDeposit.
export function updateDeposit(deposit: SiloDeposit, deltaAmount: BigInt, deltaBdv: BigInt, event: ethereum.Event): SiloDeposit | null {
  deposit.depositedAmount = deposit.depositedAmount.plus(deltaAmount);
  if (deposit.depositedAmount <= ZERO_BI) {
    store.remove("SiloDeposit", deposit.id);
    return null;
  }
  deposit.depositedBDV = deposit.depositedBDV.plus(deltaBdv);
  let depositHashes = deposit.hashes;
  depositHashes.push(event.transaction.hash.toHexString());
  deposit.hashes = depositHashes;
  deposit.createdBlock = deposit.createdBlock == ZERO_BI ? event.block.number : deposit.createdBlock;
  deposit.createdAt = deposit.createdAt == ZERO_BI ? event.block.timestamp : deposit.createdAt;
  deposit.updatedBlock = event.block.number;
  deposit.updatedAt = event.block.timestamp;
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
      siloYield.emaWindow = "ROLLING_24_HOUR";
    } else if (window == 168) {
      siloYield.emaWindow = "ROLLING_7_DAY";
    } else if (window == 720) {
      siloYield.emaWindow = "ROLLING_30_DAY";
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
