import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  TemperatureChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings,
  WhitelistToken
} from "../generated/BIP42-SeedGauge/Beanstalk";
import { handleRateChange } from "./utils/Field";
import { loadBeanstalk } from "./utils/Beanstalk";
import {
  loadSilo,
  loadSiloHourlySnapshot,
  loadSiloDailySnapshot,
  loadWhitelistTokenSetting,
  loadWhitelistTokenDailySnapshot,
  loadWhitelistTokenHourlySnapshot
} from "./utils/SiloEntities";
import { Address } from "@graphprotocol/graph-ts";

function currentSeason(beanstalk: Address): i32 {
  let beanstalkEntity = loadBeanstalk(beanstalk);
  return beanstalkEntity.lastSeason;
}

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

  // grownStalkPerBdvPerSeason variable currently stores overall, not per bdv as the name suggests
  silo.grownStalkPerBdvPerSeason = silo.depositedBDV.times(event.params.newStalkPerBdvPerSeason);
  silo.save();
  let siloHourly = loadSiloHourlySnapshot(event.address, currentSeason(event.address), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  siloHourly.grownStalkPerBdvPerSeason = silo.grownStalkPerBdvPerSeason;
  siloDaily.grownStalkPerBdvPerSeason = silo.grownStalkPerBdvPerSeason;
  siloHourly.save();
  siloDaily.save();
}

// GERMINATING STALK //

export function handleFarmerGerminatingStalkBalanceChanged(event: FarmerGerminatingStalkBalanceChanged): void {
  let farmerSilo = loadSilo(event.params.account);
  farmerSilo.germinatingStalk = farmerSilo.germinatingStalk.plus(event.params.delta);
  farmerSilo.save();

  let siloHourly = loadSiloHourlySnapshot(event.params.account, currentSeason(event.address), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.params.account, event.block.timestamp);
  siloHourly.germinatingStalk = farmerSilo.germinatingStalk;
  siloHourly.deltaGerminatingStalk = siloHourly.deltaGerminatingStalk.plus(event.params.delta);
  siloDaily.germinatingStalk = farmerSilo.germinatingStalk;
  siloDaily.deltaGerminatingStalk = siloDaily.deltaGerminatingStalk.plus(event.params.delta);
  siloHourly.save();
  siloDaily.save();
}

export function handleTotalGerminatingBalanceChanged(event: TotalGerminatingBalanceChanged): void {
  let silo = loadSilo(event.address);
  silo.germinatingStalk = silo.germinatingStalk.plus(event.params.delta);
  silo.save();

  let siloHourly = loadSiloHourlySnapshot(event.address, currentSeason(event.address), event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  siloHourly.germinatingStalk = silo.germinatingStalk;
  siloHourly.deltaGerminatingStalk = siloHourly.deltaGerminatingStalk.plus(event.params.delta);
  siloDaily.germinatingStalk = silo.germinatingStalk;
  siloDaily.deltaGerminatingStalk = siloDaily.deltaGerminatingStalk.plus(event.params.delta);
  siloHourly.save();
  siloDaily.save();
}

// WHITELIST / GAUGE CONFIGURATION SETTINGS //

export function handleWhitelistToken_BIP42(event: WhitelistToken): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);

  siloSettings.selector = event.params.selector;
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.stalkIssuedPerBdv = event.params.stalkIssuedPerBdv;
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.gpSelector = event.params.gpSelector;
  siloSettings.lwSelector = event.params.lwSelector;
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();

  let hourly = loadWhitelistTokenHourlySnapshot(event.params.token, currentSeason(event.address), event.block.timestamp);
  hourly.selector = siloSettings.selector;
  hourly.stalkEarnedPerSeason = siloSettings.stalkEarnedPerSeason;
  hourly.stalkIssuedPerBdv = siloSettings.stalkIssuedPerBdv;
  hourly.gaugePoints = siloSettings.gaugePoints;
  hourly.gpSelector = siloSettings.gpSelector;
  hourly.lwSelector = siloSettings.lwSelector;
  hourly.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  hourly.updatedAt = siloSettings.updatedAt;
  hourly.save();

  let daily = loadWhitelistTokenDailySnapshot(event.params.token, event.block.timestamp);
  daily.selector = siloSettings.selector;
  daily.stalkEarnedPerSeason = siloSettings.stalkEarnedPerSeason;
  daily.stalkIssuedPerBdv = siloSettings.stalkIssuedPerBdv;
  daily.gaugePoints = siloSettings.gaugePoints;
  daily.gpSelector = siloSettings.gpSelector;
  daily.lwSelector = siloSettings.lwSelector;
  daily.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  daily.updatedAt = siloSettings.updatedAt;
  daily.save();
}

export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = event.params.gpSelector;
  siloSettings.lwSelector = event.params.lwSelector;
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();

  let hourly = loadWhitelistTokenHourlySnapshot(event.params.token, currentSeason(event.address), event.block.timestamp);
  hourly.gpSelector = siloSettings.gpSelector;
  hourly.lwSelector = siloSettings.lwSelector;
  hourly.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  hourly.updatedAt = siloSettings.updatedAt;
  hourly.save();

  let daily = loadWhitelistTokenDailySnapshot(event.params.token, event.block.timestamp);
  daily.gpSelector = siloSettings.gpSelector;
  daily.lwSelector = siloSettings.lwSelector;
  daily.optimalPercentDepositedBdv = siloSettings.optimalPercentDepositedBdv;
  daily.updatedAt = siloSettings.updatedAt;
  daily.save();
}
