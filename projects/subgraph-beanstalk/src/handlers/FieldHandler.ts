import { BigInt, log } from "@graphprotocol/graph-ts";
import { BEANSTALK_FARMS } from "../../../subgraph-core/utils/Constants";
import { loadField } from "../entities/Field";
import { harvest, plotTransfer, sow, temperatureChanged } from "../utils/Field";
import { Sow, Harvest, PlotTransfer, TemperatureChange } from "../../generated/Beanstalk-ABIs/SeedGauge";

export function handleSow(event: Sow): void {
  let sownOverride: BigInt | null = null;
  if (event.params.account == BEANSTALK_FARMS) {
    let startingField = loadField(event.address);
    sownOverride = startingField.soil;
  }
  sow({
    event,
    account: event.params.account,
    fieldId: null,
    index: event.params.index,
    beans: sownOverride !== null ? sownOverride : event.params.beans,
    pods: event.params.pods
  });
}

export function handleHarvest(event: Harvest): void {
  harvest({
    event,
    account: event.params.account,
    fieldId: null,
    plots: event.params.plots,
    beans: event.params.beans
  });
}

export function handlePlotTransfer(event: PlotTransfer): void {
  plotTransfer({
    event,
    from: event.params.from,
    to: event.params.to,
    fieldId: null,
    index: event.params.id,
    amount: event.params.pods
  });
}

export function handleTemperatureChange(event: TemperatureChange): void {
  temperatureChanged({
    event,
    season: event.params.season,
    caseId: event.params.caseId,
    absChange: event.params.absChange
  });
}
