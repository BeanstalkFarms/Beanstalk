import { BigDecimal } from "@graphprotocol/graph-ts";
import { BEANSTALK, BEANSTALK_PRICE } from "../../subgraph-core/utils/Constants";
import { ONE_BD, ZERO_BD, toDecimal } from "../../subgraph-core/utils/Decimals";
import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  TemperatureChange,
  UpdateAverageStalkPerBdvPerSeason,
  UpdateGaugeSettings,
  WhitelistToken
} from "../generated/BIP42-SeedGauge/Beanstalk";
import { BeanstalkPrice } from "../generated/BIP42-SeedGauge/BeanstalkPrice";
import { loadField, loadFieldDaily, loadFieldHourly } from "./utils/Field";
import { loadSeason } from "./utils/Season";
import { loadWhitelistTokenSetting } from "./utils/SiloEntities";
import { loadSilo } from "./utils/SiloEntities";

export function handleTemperatureChange(event: TemperatureChange): void {
  let field = loadField(event.address);
  let fieldHourly = loadFieldHourly(event.address, event.params.season.toI32(), event.block.timestamp);
  let fieldDaily = loadFieldDaily(event.address, event.block.timestamp);

  field.temperature += event.params.absChange;
  fieldHourly.temperature += event.params.absChange;
  fieldDaily.temperature += event.params.absChange;

  // Real Rate of Return

  let season = loadSeason(event.address, event.params.season);

  let currentPrice = ZERO_BD;
  if (season.price != ZERO_BD) {
    currentPrice = season.price;
  } else {
    // Attempt to pull from Beanstalk Price contract first
    let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
    let beanstalkQuery = beanstalkPrice.try_price();
    if (!beanstalkQuery.reverted) {
      currentPrice = toDecimal(beanstalkQuery.value.price);
    }
  }

  field.realRateOfReturn = ONE_BD.plus(BigDecimal.fromString((field.temperature / 100).toString())).div(currentPrice);
  fieldHourly.realRateOfReturn = field.realRateOfReturn;
  fieldHourly.realRateOfReturn = field.realRateOfReturn;

  field.save();
  fieldHourly.save();
  fieldDaily.save();
}

export function handleBeanToMaxLpGpPerBdvRatioChange(event: BeanToMaxLpGpPerBdvRatioChange): void {
  let silo = loadSilo(BEANSTALK);

  if (silo.beanToMaxLpGpPerBdvRatio == null) {
    silo.beanToMaxLpGpPerBdvRatio = event.params.absChange;
  } else {
    silo.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio.plus(event.params.absChange);
  }
  silo.save();
}

export function handleGaugePointChange(event: GaugePointChange): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.updatedAt = event.block.timestamp;
  siloSettings.save();
}

export function handleUpdateAverageStalkPerBdvPerSeason(event: UpdateAverageStalkPerBdvPerSeason): void {
  let silo = loadSilo(BEANSTALK);

  silo.grownStalkPerBdvPerSeason = event.params.newStalkPerBdvPerSeason;
  silo.save();
}

// TODO: Germinating stalk.

export function handleWhitelistToken_BIP42(event: WhitelistToken): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);

  siloSettings.selector = event.params.selector;
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.stalkIssuedPerBdv = event.params.stalkIssuedPerBdv;
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.gpSelector = event.params.gpSelector;
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
