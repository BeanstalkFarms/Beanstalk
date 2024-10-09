import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { WeatherChange, SupplyIncrease, SupplyDecrease, SupplyNeutral, FundFundraiser } from "../../../generated/Beanstalk-ABIs/PreReplant";
import {
  Harvest as Harvest_v1,
  PlotTransfer as PlotTransfer_v1,
  Sow as Sow_v1,
  TemperatureChange as TemperatureChange_v1
} from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { harvest, plotTransfer, sow, temperatureChanged, updateFieldTotals } from "../../utils/Field";
import { legacySowAmount } from "../../utils/legacy/LegacyField";

// PreReplant -> SeedGauge
export function handleWeatherChange(event: WeatherChange): void {
  temperatureChanged({
    event,
    season: event.params.season,
    caseId: event.params.caseId,
    absChange: event.params.change
  });
}

// PreReplant -> Replanted
export function handleSupplyIncrease(event: SupplyIncrease): void {
  updateFieldTotals(event.address, event.address, event.params.newSoil, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.block);
}

// PreReplant -> Replanted
export function handleSupplyDecrease(event: SupplyDecrease): void {
  updateFieldTotals(event.address, event.address, event.params.newSoil, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.block);
}

// PreReplant -> Replanted
export function handleSupplyNeutral(event: SupplyNeutral): void {
  updateFieldTotals(event.address, event.address, event.params.newSoil, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.block);
}

// PreReplant -> Replanted
export function handleFundFundraiser(event: FundFundraiser): void {
  // Account for the fact that fundraiser sow using no soil.
  updateFieldTotals(
    event.address,
    event.address,
    ZERO_BI,
    ZERO_BI.minus(event.params.amount),
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    event.block
  );
}

// PreReplant -> Reseed
export function handleSow_v1(event: Sow_v1): void {
  let sownOverride = legacySowAmount(event.address, event.params.account);
  sow({
    event,
    account: event.params.account,
    fieldId: null,
    index: event.params.index,
    beans: sownOverride !== null ? sownOverride : event.params.beans,
    pods: event.params.pods
  });
}

// PreReplant -> Reseed
export function handleHarvest_v1(event: Harvest_v1): void {
  harvest({
    event,
    account: event.params.account,
    fieldId: null,
    plots: event.params.plots,
    beans: event.params.beans
  });
}

// PreReplant -> Reseed
export function handlePlotTransfer_v1(event: PlotTransfer_v1): void {
  plotTransfer({
    event,
    from: event.params.from,
    to: event.params.to,
    fieldId: null,
    index: event.params.id,
    amount: event.params.pods
  });
}

// SeedGauge -> Reseed
export function handleTemperatureChange_v1(event: TemperatureChange_v1): void {
  temperatureChanged({
    event,
    season: event.params.season,
    caseId: event.params.caseId,
    absChange: event.params.absChange
  });
}
