import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import {
  AddMigratedDeposit,
  InternalBalanceMigrated,
  MigratedPlot,
  MigratedPodListing,
  MigratedPodOrder
} from "../../../generated/Beanstalk-ABIs/Reseed";
import { getHarvestableIndex, loadFarmer } from "../../entities/Beanstalk";
import { loadField, loadPlot } from "../../entities/Field";
import { clearFieldDeltas, takeFieldSnapshots } from "../../entities/snapshots/Field";
import { updateFarmTotals } from "../../utils/Farm";
import { podListingCreated, podOrderCreated } from "../../utils/Marketplace";
import { addDeposits } from "../../utils/Silo";

export function handleAddMigratedDeposit(event: AddMigratedDeposit): void {
  addDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: null,
    stems: [event.params.stem],
    amounts: [event.params.amount],
    bdvs: [event.params.bdv],
    depositVersion: "stem"
  });
}

export function handleMigratedPlot(event: MigratedPlot): void {
  // The migration logic conflicts with some cumulative values already set in utils/b3-migration/Init.
  // Therefore the basic "sow" method is unsuitable for this purpose

  const harvestableIndex = getHarvestableIndex();
  const plotStart = event.params.plotIndex;
  const plotEnd = event.params.plotIndex.plus(event.params.pods);
  let harvestablePods = ZERO_BI;
  let unharvestablePods = event.params.pods;
  if (plotStart < harvestableIndex && plotEnd > harvestableIndex) {
    // Partially harvestable
    harvestablePods = harvestableIndex.minus(plotStart);
    unharvestablePods = event.params.pods.minus(harvestablePods);
  } else if (plotEnd <= harvestableIndex) {
    // Fully harvestable
    harvestablePods = event.params.pods;
    unharvestablePods = ZERO_BI;
  }

  let field = loadField(event.address);
  field.unharvestablePods = field.unharvestablePods.plus(unharvestablePods);
  field.harvestablePods = field.harvestablePods.plus(harvestablePods);
  takeFieldSnapshots(field, event.block);
  field.save();
  clearFieldDeltas(field, event.block);

  let accountField = loadField(event.params.account);
  accountField.unharvestablePods = accountField.unharvestablePods.plus(unharvestablePods);
  accountField.harvestablePods = accountField.harvestablePods.plus(harvestablePods);
  takeFieldSnapshots(accountField, event.block);
  accountField.save();
  clearFieldDeltas(accountField, event.block);

  loadFarmer(event.params.account);
  let plot = loadPlot(event.address, event.params.plotIndex);

  plot.farmer = event.params.account;
  plot.source = "Reseed Migrated";
  plot.sourceHash = event.transaction.hash;
  plot.season = 0;
  plot.creationHash = event.transaction.hash;
  plot.createdAt = event.block.timestamp;
  plot.updatedAt = event.block.timestamp;
  plot.updatedAtBlock = event.block.number;
  plot.pods = event.params.pods;
  plot.beansPerPod = ZERO_BI;
  plot.save();
}

export function handleMigratedPodListing(event: MigratedPodListing): void {
  podListingCreated({
    event: event,
    account: event.params.lister,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.podAmount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.mode,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handleMigratedPodOrder(event: MigratedPodOrder): void {
  podOrderCreated({
    event: event,
    account: event.params.orderer,
    id: event.params.id,
    beanAmount: event.params.beanAmount,
    pricePerPod: event.params.pricePerPod,
    maxPlaceInLine: event.params.maxPlaceInLine,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handleInternalBalanceMigrated(event: InternalBalanceMigrated): void {
  loadFarmer(event.params.account);
  updateFarmTotals(event.address, event.params.account, event.params.token, event.params.delta, event.block);
}

// Not currently necessary to handle the below. They are appropriately accounted for by the other events
// MigratedAccountStatus - AddMigratedDeposit
// FertilizerMigrated - TransferSingle events on fertilizer mints
