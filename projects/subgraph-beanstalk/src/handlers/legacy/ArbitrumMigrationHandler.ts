import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import {
  AddMigratedDeposit,
  InternalBalanceMigrated,
  L1PlotsMigrated,
  MigratedAccountStatus,
  MigratedPlot,
  MigratedPodListing,
  MigratedPodOrder
} from "../../../generated/Beanstalk-ABIs/Reseed";
import { getHarvestableIndex, loadFarmer } from "../../entities/Beanstalk";
import { loadField, loadPlot } from "../../entities/Field";
import { clearFieldDeltas, takeFieldSnapshots } from "../../entities/snapshots/Field";
import { updateFarmTotals } from "../../utils/Farm";
import { podListingCreated, podOrderCreated } from "../../utils/Marketplace";
import { addDeposits, updateStalkBalances } from "../../utils/Silo";

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

export function handleMigratedAccountStatus(event: MigratedAccountStatus): void {
  updateStalkBalances(event.address, event.params.account, event.params.stalk, event.params.roots, event.block);
}

// Executed upon Reseed
export function handleMigratedPlot(event: MigratedPlot): void {
  addMigratedPlot(event.params.account, event.params.plotIndex, event.params.pods, event, true);
}

// Executed upon contract balances migrated to L2
export function handleL1PlotsMigrated(event: L1PlotsMigrated): void {
  for (let i = 0; i < event.params.index.length; ++i) {
    addMigratedPlot(event.params.receiver, event.params.index[i], event.params.pods[i], event, false);
  }
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

// isReseed: true for reseed scripts, false for contract account migration (see L1ReceiverFacet.sol)
function addMigratedPlot(account: Address, index: BigInt, amount: BigInt, event: ethereum.Event, isReseed: boolean): void {
  // The migration logic conflicts with some cumulative values already set in utils/b3-migration/Init.
  // Therefore the basic "sow" method is unsuitable for this purpose

  const harvestableIndex = getHarvestableIndex();
  const plotStart = index;
  const plotEnd = index.plus(amount);
  let harvestablePods = ZERO_BI;
  let unharvestablePods = amount;
  if (plotStart < harvestableIndex && plotEnd > harvestableIndex) {
    // Partially harvestable
    harvestablePods = harvestableIndex.minus(plotStart);
    unharvestablePods = amount.minus(harvestablePods);
  } else if (plotEnd <= harvestableIndex) {
    // Fully harvestable
    harvestablePods = amount;
    unharvestablePods = ZERO_BI;
  }

  let field = loadField(event.address);
  field.unharvestablePods = field.unharvestablePods.plus(unharvestablePods);
  field.harvestablePods = field.harvestablePods.plus(harvestablePods);

  loadFarmer(account);
  let plot = loadPlot(event.address, index);

  let newIndexes = field.plotIndexes;
  newIndexes.push(plot.index);
  field.plotIndexes = newIndexes;

  takeFieldSnapshots(field, event.block);
  field.save();

  let accountField = loadField(account);
  accountField.unharvestablePods = accountField.unharvestablePods.plus(unharvestablePods);
  accountField.harvestablePods = accountField.harvestablePods.plus(harvestablePods);
  takeFieldSnapshots(accountField, event.block);
  accountField.save();

  if (isReseed) {
    clearFieldDeltas(field, event.block);
    clearFieldDeltas(accountField, event.block);
  }

  plot.farmer = account;
  plot.source = isReseed ? "RESEED_MIGRATED" : "CONTRACT_RECEIVER_MIGRATED";
  plot.sourceHash = event.transaction.hash;
  plot.season = 0;
  plot.creationHash = event.transaction.hash;
  plot.createdAt = event.block.timestamp;
  plot.updatedAt = event.block.timestamp;
  plot.updatedAtBlock = event.block.number;
  plot.pods = amount;
  plot.beansPerPod = ZERO_BI;
  plot.save();
}

// Not currently necessary to handle the below. They are appropriately accounted for by the other events
//// Reseed:
// FertilizerMigrated - TransferSingle events on fertilizer mints
//// L1ReceiverFacet (Contract migration):
// L1BeansMigrated - ERC20 mint suffices
// L1FertilizerMigrated - TransferSingle events on fertilizer mints
// L1DepositsMigrated - AddDeposit is emitted
// L1InternalBalancesMigrated - InternalBalanceChanged is emitted
