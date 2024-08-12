import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { WeatherChange, SupplyIncrease, SupplyDecrease, SupplyNeutral, FundFundraiser } from "../../../generated/Beanstalk-ABIs/PreReplant";
import { temperatureChanged, updateFieldTotals } from "../../utils/Field";

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
  updateFieldTotals(
    event.address,
    event.address,
    event.params.newSoil,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    event.block.timestamp,
    event.block.number
  );
}

// PreReplant -> Replanted
export function handleSupplyDecrease(event: SupplyDecrease): void {
  updateFieldTotals(
    event.address,
    event.address,
    event.params.newSoil,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    event.block.timestamp,
    event.block.number
  );
}

// PreReplant -> Replanted
export function handleSupplyNeutral(event: SupplyNeutral): void {
  updateFieldTotals(
    event.address,
    event.address,
    event.params.newSoil,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    event.block.timestamp,
    event.block.number
  );
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
    event.block.timestamp,
    event.block.number
  );
}
