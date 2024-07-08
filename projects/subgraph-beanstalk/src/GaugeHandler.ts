import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  TemperatureChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings,
  WhitelistToken,
  TotalGerminatingStalkChanged,
  TotalStalkChangedFromGermination
} from "../generated/BIP45-SeedGauge/Beanstalk";
import { handleRateChange } from "./utils/Field";
import {
  loadSilo,
  loadSiloHourlySnapshot,
  loadSiloDailySnapshot,
  loadWhitelistTokenSetting,
  loadWhitelistTokenDailySnapshot,
  loadWhitelistTokenHourlySnapshot
} from "./utils/SiloEntities";
import { deleteGerminating, loadGerminating, loadOrCreateGerminating } from "./utils/Germinating";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { updateStalkBalances } from "./SiloHandler";
import { getCurrentSeason } from "./utils/Season";
import { WhitelistToken as WhitelistTokenEntity } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";
import { Bytes4_emptyToNull } from "../../subgraph-core/utils/Bytes";

export function handleTemperatureChange(event: TemperatureChange): void {
  handleRateChange(event.address, event.block, event.params.season, event.params.caseId, event.params.absChange);
}

// SEED GAUGE SEASONAL ADJUSTMENTS //

export function handleBeanToMaxLpGpPerBdvRatioChange(event: BeanToMaxLpGpPerBdvRatioChange): void {
  let silo = loadSilo(event.address);

  if (silo.beanToMaxLpGpPerBdvRatio === null) {
    silo.beanToMaxLpGpPerBdvRatio = event.params.absChange;
  } else {
    silo.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio!.plus(event.params.absChange);
  }
  silo.save();

  let siloHourly = loadSiloHourlySnapshot(event.address, event.params.season.toI32(), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  siloHourly.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
  siloHourly.caseId = event.params.caseId;
  siloDaily.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
  siloHourly.save();
  siloDaily.save();
}

export function handleGaugePointChange(event: GaugePointChange): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();

  let whitelistHourly = loadWhitelistTokenHourlySnapshot(event.params.token, event.params.season.toI32(), event.block.timestamp);
  let whitelistDaily = loadWhitelistTokenDailySnapshot(event.params.token, event.block.timestamp);
  whitelistHourly.gaugePoints = event.params.gaugePoints;
  whitelistDaily.gaugePoints = event.params.gaugePoints;
  whitelistHourly.save();
  whitelistDaily.save();
}

export function handleUpdateAverageStalkPerBdvPerSeason(event: UpdateAverageStalkPerBdvPerSeason): void {
  let silo = loadSilo(event.address);

  silo.grownStalkPerSeason = silo.depositedBDV.times(event.params.newStalkPerBdvPerSeason);
  silo.save();
  let siloHourly = loadSiloHourlySnapshot(event.address, getCurrentSeason(event.address), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  siloHourly.grownStalkPerSeason = silo.grownStalkPerSeason;
  siloDaily.grownStalkPerSeason = silo.grownStalkPerSeason;
  siloHourly.save();
  siloDaily.save();

  // Individual asset grown stalk is set by the UpdatedStalkPerBdvPerSeason event in SiloHandler
}

// GERMINATING STALK //

// Tracks germinating balances for individual famers
export function handleFarmerGerminatingStalkBalanceChanged(event: FarmerGerminatingStalkBalanceChanged): void {
  if (event.params.deltaGerminatingStalk == ZERO_BI) {
    return;
  }

  const currentSeason = getCurrentSeason(event.address);

  if (event.params.deltaGerminatingStalk > ZERO_BI) {
    // Germinating stalk is being added in the current season
    let farmerGerminating = loadOrCreateGerminating(event.params.account, currentSeason);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(event.params.deltaGerminatingStalk);
    farmerGerminating.save();
  } else {
    // Germinating stalk is being removed. It therefore must have created the entity already
    let farmerGerminating = loadGerminating(event.params.account, event.params.germinationState);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(event.params.deltaGerminatingStalk);
    if (farmerGerminating.stalk == ZERO_BI) {
      deleteGerminating(farmerGerminating);
    } else {
      farmerGerminating.save();
    }
  }

  let farmerSilo = loadSilo(event.params.account);
  farmerSilo.germinatingStalk = farmerSilo.germinatingStalk.plus(event.params.deltaGerminatingStalk);
  farmerSilo.save();

  let siloHourly = loadSiloHourlySnapshot(event.params.account, currentSeason, event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.params.account, event.block.timestamp);
  siloHourly.germinatingStalk = farmerSilo.germinatingStalk;
  siloHourly.deltaGerminatingStalk = siloHourly.deltaGerminatingStalk.plus(event.params.deltaGerminatingStalk);
  siloDaily.germinatingStalk = farmerSilo.germinatingStalk;
  siloDaily.deltaGerminatingStalk = siloDaily.deltaGerminatingStalk.plus(event.params.deltaGerminatingStalk);
  siloHourly.save();
  siloDaily.save();
}

// Tracks the germinating balance on a token level
export function handleTotalGerminatingBalanceChanged(event: TotalGerminatingBalanceChanged): void {
  if (event.params.deltaAmount == ZERO_BI && event.params.deltaBdv == ZERO_BI) {
    return;
  }

  let tokenGerminating = loadOrCreateGerminating(event.params.token, event.params.germinationSeason.toU32());
  tokenGerminating.season = event.params.germinationSeason.toU32();
  tokenGerminating.tokenAmount = tokenGerminating.tokenAmount.plus(event.params.deltaAmount);
  tokenGerminating.bdv = tokenGerminating.bdv.plus(event.params.deltaBdv);
  if (tokenGerminating.tokenAmount == ZERO_BI) {
    deleteGerminating(tokenGerminating);
  } else {
    tokenGerminating.save();
  }
}

// This occurs at the beanstalk level regardless of whether users mow their own germinating stalk into regular stalk.
export function handleTotalGerminatingStalkChanged(event: TotalGerminatingStalkChanged): void {
  if (event.params.deltaGerminatingStalk == ZERO_BI) {
    return;
  }

  let siloGerminating = loadOrCreateGerminating(event.address, event.params.germinationSeason.toU32());
  siloGerminating.season = event.params.germinationSeason.toU32();
  siloGerminating.stalk = siloGerminating.stalk.plus(event.params.deltaGerminatingStalk);
  // Don't delete this entity as the overall silo germinating stalk entity is likely to be recreated frequently.
  siloGerminating.save();

  let silo = loadSilo(event.address);
  silo.germinatingStalk = silo.germinatingStalk.plus(event.params.deltaGerminatingStalk);
  silo.save();

  let siloHourly = loadSiloHourlySnapshot(event.address, getCurrentSeason(event.address), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  siloHourly.germinatingStalk = silo.germinatingStalk;
  siloHourly.deltaGerminatingStalk = siloHourly.deltaGerminatingStalk.plus(event.params.deltaGerminatingStalk);
  siloDaily.germinatingStalk = silo.germinatingStalk;
  siloDaily.deltaGerminatingStalk = siloDaily.deltaGerminatingStalk.plus(event.params.deltaGerminatingStalk);
  siloHourly.save();
  siloDaily.save();
}

// Germination completes, germinating stalk turns into stalk.
// The removal of Germinating stalk would have already been handled from a separate emission
export function handleTotalStalkChangedFromGermination(event: TotalStalkChangedFromGermination): void {
  updateStalkBalances(
    event.address,
    getCurrentSeason(event.address),
    event.params.deltaStalk,
    event.params.deltaRoots,
    event.block.timestamp,
    event.block.number
  );
}

// WHITELIST / GAUGE CONFIGURATION SETTINGS //

export function handleWhitelistToken_BIP45(event: WhitelistToken): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);

  siloSettings.selector = event.params.selector;
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.stalkIssuedPerBdv = event.params.stalkIssuedPerBdv;
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();

  loadWhitelistTokenHourlySnapshot(event.params.token, getCurrentSeason(event.address), event.block.timestamp);
  loadWhitelistTokenDailySnapshot(event.params.token, event.block.timestamp);

  let id = "whitelistToken-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rawEvent = new WhitelistTokenEntity(id);
  rawEvent.hash = event.transaction.hash.toHexString();
  rawEvent.logIndex = event.logIndex.toI32();
  rawEvent.protocol = event.address.toHexString();
  rawEvent.token = event.params.token.toHexString();
  rawEvent.blockNumber = event.block.number;
  rawEvent.createdAt = event.block.timestamp;
  rawEvent.save();
}

export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  let hourly = loadWhitelistTokenHourlySnapshot(event.params.token, getCurrentSeason(event.address), event.block.timestamp);
  hourly.gpSelector = siloSettings.gpSelector;
  hourly.lwSelector = siloSettings.lwSelector;
  hourly.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  hourly.updatedAt = siloSettings.updatedAt;

  let daily = loadWhitelistTokenDailySnapshot(event.params.token, event.block.timestamp);
  daily.gpSelector = siloSettings.gpSelector;
  daily.lwSelector = siloSettings.lwSelector;
  daily.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  daily.updatedAt = siloSettings.updatedAt;

  // On initial gauge deployment, there was no GaugePointChange event emitted. Need to initialize BEANETH here
  if (
    event.params.token == BEAN_WETH_CP2_WELL &&
    event.transaction.hash.toHexString().toLowerCase() == "0x299a4b93b8d19f8587b648ce04e3f5e618ea461426bb2b2337993b5d6677f6a7"
  ) {
    siloSettings.gaugePoints = BI_10.pow(20);
    hourly.gaugePoints = BI_10.pow(20);
    daily.gaugePoints = BI_10.pow(20);
  }
  siloSettings.save();
  hourly.save();
  daily.save();
}
