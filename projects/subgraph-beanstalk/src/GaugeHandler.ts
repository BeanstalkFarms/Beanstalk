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
import { loadWhitelistTokenSetting } from "./utils/SiloEntities";
import { loadSilo, loadSiloHourlySnapshot } from "./utils/SiloEntities";

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
  siloHourly.caseId = event.params.caseId;
  siloHourly.save();
}

export function handleGaugePointChange(event: GaugePointChange): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();
}

export function handleUpdateAverageStalkPerBdvPerSeason(event: UpdateAverageStalkPerBdvPerSeason): void {
  let silo = loadSilo(event.address);
  silo.grownStalkPerBdvPerSeason = event.params.newStalkPerBdvPerSeason;
  silo.save();
}

// GERMINATING STALK //

export function handleFarmerGerminatingStalkBalanceChanged(event: FarmerGerminatingStalkBalanceChanged): void {
  let farmerSilo = loadSilo(event.params.account);
  farmerSilo.germinatingStalk = farmerSilo.germinatingStalk.plus(event.params.delta);
  farmerSilo.save();
}

export function handleTotalGerminatingBalanceChanged(event: TotalGerminatingBalanceChanged): void {
  let silo = loadSilo(event.address);
  silo.germinatingStalk = silo.germinatingStalk.plus(event.params.delta);
  silo.save();
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
}

export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = event.params.gpSelector;
  siloSettings.lwSelector = event.params.lwSelector;
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();
}
