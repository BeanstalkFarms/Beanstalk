/// <reference path="../../../node_modules/assemblyscript/dist/assemblyscript.d.ts" />

import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { logStore } from "matchstick-as/assembly/store";
import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createSowEvent, createPlotTransferEvent } from "./event-mocking/Field";
import { createIncentivizationEvent } from "./event-mocking/Season";

import { loadSeason } from "../src/utils/Season";

import { handleSow, handlePlotTransfer } from "../src/FieldHandler";
import { handleIncentive } from "../src/SeasonHandler";
import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";

const ANVIL_ADDR_1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();
const ANVIL_ADDR_2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();

// These functions may exist elsewhere but I dont know of them
const beans = (b: number): BigInt => BigInt.fromI32(<i32>b).times(BigInt.fromI32(10).pow(6));
const mil = (m: number): BigInt => BigInt.fromI32(<i32>m).times(BigInt.fromI32(10).pow(12));

// 2 plots: each sow 500 for 7500 at 10m and 15m in line.
const plot1Start = mil(10);
const plot2Start = mil(15);
const beansSown = beans(500);
const temperature = 15;
const pods = beansSown.times(BigInt.fromI32(temperature));

class Plot {
  plotStart: BigInt;
  beansSown: BigInt;
  temperature: i32;
  pods: BigInt;
  plotEnd: BigInt;
}

const initialPlots: Plot[] = [
  {
    plotStart: plot1Start,
    beansSown,
    temperature,
    pods,
    plotEnd: plot1Start.plus(pods)
  },
  {
    plotStart: plot2Start,
    beansSown,
    temperature,
    pods,
    plotEnd: plot2Start.plus(pods)
  }
];

const assertFarmerHasPlot = (
  farmer: string,
  index: BigInt,
  numPods: BigInt,
  numHarvestable: BigInt = ZERO_BI,
  debug: boolean = false
): void => {
  if (debug) {
    log.debug("about to assert plot {}", [farmer]);
  }
  assert.fieldEquals("Plot", index.toString(), "farmer", farmer);
  assert.fieldEquals("Plot", index.toString(), "pods", numPods.toString());
  // log.debug("about to assert harvestable {}", [numHarvestable.toString()]);
  assert.fieldEquals("Plot", index.toString(), "harvestablePods", numHarvestable.toString());
};

// Field can be either a farmer or beanstalk address
const assertFieldHas = (field: string, unharvestable: BigInt, harvestable: BigInt, debug: boolean = false): void => {
  if (debug) {
    log.debug("about to assert field {}", [field]);
  }
  assert.fieldEquals("Field", field, "unharvestablePods", unharvestable.toString());
  assert.fieldEquals("Field", field, "harvestablePods", harvestable.toString());
};

const setHarvestable = (harvestableIndex: BigInt): BigInt => {
  createMockedFunction(BEANSTALK, "harvestableIndex", "harvestableIndex():(uint256)")
    // @ts-expect-error:2322
    .returns([ethereum.Value.fromUnsignedBigInt(harvestableIndex)]);

  // Incentivization event triggers update of harvestable amount of each plot
  handleIncentive(createIncentivizationEvent(ANVIL_ADDR_1, BigInt.fromI32(123456)));

  return harvestableIndex;
};

// Begin tests
describe("Field: Plot Transfer", () => {
  beforeEach(() => {
    // Create two equally sized plots next to each other
    for (let i = 0; i < initialPlots.length; ++i) {
      handleSow(createSowEvent(ANVIL_ADDR_1, initialPlots[i].plotStart, initialPlots[i].beansSown, initialPlots[i].pods));
    }
    // Ensure setup was done correctly
    assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods);
    assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    assert.notInStore("Field", ANVIL_ADDR_2);
    assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);

    log.info("Initial data populated", []);
  });

  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  // Transfers entire first plot
  describe("Full Plot", () => {
    test("F: Unharvestable", () => {
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods));

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("F: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(initialPlots[0].pods);
      // season.save();

      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods));

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods, initialPlots[0].pods);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, ZERO_BI, initialPlots[0].pods);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("F: Harvestable (Partial)", () => {
      // 1/3 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(harvestableAmount);
      // season.save();

      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods));

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods, harvestableAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods.minus(harvestableAmount), harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });
  });

  // Transfers the first third of the plot
  describe("Partial Plot: From Start", () => {
    test("S: Unharvestable", () => {
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(ANVIL_ADDR_1, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("S: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(initialPlots[0].pods);
      // season.save();

      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(
        ANVIL_ADDR_1,
        transferredIndex.plus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount)
      );
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(ANVIL_ADDR_2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("S: Harvestable (Partial)", () => {
      // 1/4 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(4));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(harvestableAmount);
      // season.save();

      // Transfers first third of plot (only some of which is harvestable)
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      const transferredUnharvestable = transferredAmount.minus(harvestableAmount);
      assertFarmerHasPlot(ANVIL_ADDR_1, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount), ZERO_BI);
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, harvestableAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredUnharvestable, harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });
  });

  // Transfers the final third of the plot
  describe("Partial Plot: To End", () => {
    test("E: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("E: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(initialPlots[0].pods);
      // season.save();

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(
        ANVIL_ADDR_1,
        initialPlots[0].plotStart,
        initialPlots[0].pods.minus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount)
      );
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(ANVIL_ADDR_2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("E: Harvestable (Partial)", () => {
      // 3/4 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.times(BigInt.fromI32(3)).div(BigInt.fromI32(4));
      const harvestableIndex = setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(harvestableAmount);
      // season.save();

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      const transferredHarvestable = harvestableIndex.minus(transferredIndex);
      assertFarmerHasPlot(
        ANVIL_ADDR_1,
        initialPlots[0].plotStart,
        initialPlots[0].pods.minus(transferredAmount),
        harvestableAmount.minus(transferredHarvestable)
      );
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, transferredHarvestable);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, harvestableAmount.minus(transferredHarvestable));
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods.minus(harvestableAmount), transferredHarvestable);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });
  });

  // Transfers the middle third of the plot
  describe("Partial Plot: Middle", () => {
    test("M: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, transferredAmount);
      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount);
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("M: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(initialPlots[0].pods);
      // season.save();

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, transferredAmount, transferredAmount);
      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount, transferredAmount);
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(ANVIL_ADDR_2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods, initialPlots[1].pods);
    });

    test("M: Harvestable (Partial)", () => {
      // 1/2 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(2));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));
      // const season = loadSeason(BEANSTALK, BigInt.fromU32(1));
      // season.harvestableIndex = initialPlots[0].plotStart.plus(harvestableAmount);
      // season.save();

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount));

      const transferredHarvestable = harvestableAmount.minus(transferredAmount);
      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, transferredAmount, harvestableAmount.minus(transferredHarvestable));
      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount, ZERO_BI);
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, transferredHarvestable);
      assertFieldHas(
        ANVIL_ADDR_1,
        initialPlots[0].pods.minus(harvestableAmount).minus(transferredHarvestable).plus(initialPlots[1].pods),
        harvestableAmount.minus(transferredHarvestable)
      );
      assertFieldHas(ANVIL_ADDR_2, transferredHarvestable, transferredHarvestable);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods).minus(harvestableAmount), harvestableAmount);
    });
  });

  // Unclear whether tests like this are actually necessary
  // describe("Invalid Transfers", () => {
  //   test("Too Many", () => {
  //     // Try to send 1/10^6 more pods.
  //     handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods.plus(BigInt.fromI32(1))));
  //   });
  //   test("Unowned Plot", () => {
  //     // Try to send someone else's plot
  //     handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_2, ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods));
  //   });
  // });
});
