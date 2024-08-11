import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction } from "matchstick-as/assembly/index";
import { createHarvestEvent, createPlotTransferEvent, createSowEvent } from "../event-mocking/Field";
import { handleHarvest, handlePlotTransfer, handleSow } from "../../src/handlers/FieldHandler";
import { createIncentivizationEvent } from "../event-mocking/Season";
import { handleIncentive } from "../../src/handlers/SeasonHandler";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";

const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();

export function sow(account: string, index: BigInt, beans: BigInt, pods: BigInt): void {
  handleSow(createSowEvent(account, index, beans, pods));
}

export function harvest(account: string, plotIndexex: BigInt[], beans: BigInt): void {
  handleHarvest(createHarvestEvent(account, plotIndexex, beans));
}

export function transferPlot(from: string, to: string, id: BigInt, amount: BigInt): void {
  handlePlotTransfer(createPlotTransferEvent(from, to, id, amount));
}

export function setHarvestable(harvestableIndex: BigInt): BigInt {
  createMockedFunction(BEANSTALK, "harvestableIndex", "harvestableIndex():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(harvestableIndex)
  ]);

  // Incentivization event triggers update of harvestable amount of each plot
  handleIncentive(createIncentivizationEvent(account, BigInt.fromI32(123456)));

  return harvestableIndex;
}

export function assertFarmerHasPlot(
  farmer: string,
  index: BigInt,
  numPods: BigInt,
  numHarvestable: BigInt = ZERO_BI,
  debug: boolean = false
): void {
  if (debug) {
    log.debug("about to assert plot {}", [farmer]);
  }
  assert.fieldEquals("Plot", index.toString(), "farmer", farmer);
  assert.fieldEquals("Plot", index.toString(), "pods", numPods.toString());
  // log.debug("about to assert harvestable {}", [numHarvestable.toString()]);
  assert.fieldEquals("Plot", index.toString(), "harvestablePods", numHarvestable.toString());
}

// Field can be either a farmer or beanstalk address
export function assertFieldHas(field: string, unharvestable: BigInt, harvestable: BigInt, debug: boolean = false): void {
  if (debug) {
    log.debug("about to assert field {}", [field]);
  }
  assert.fieldEquals("Field", field, "unharvestablePods", unharvestable.toString());
  assert.fieldEquals("Field", field, "harvestablePods", harvestable.toString());
}
