/// <reference path="../../../node_modules/assemblyscript/dist/assemblyscript.d.ts" />

import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { BigInt } from "@graphprotocol/graph-ts";

import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { beans_BI as beans, podlineMil_BI as mil } from "../../subgraph-core/tests/Values";
import { assertFarmerHasPlot, assertFieldHas, setHarvestable, sow, transferPlot } from "./utils/Field";

const ANVIL_ADDR_1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();
const ANVIL_ADDR_2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();

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

// Begin tests
describe("Field: Plot Transfer", () => {
  beforeEach(() => {
    // Create two equally sized plots next to each other
    for (let i = 0; i < initialPlots.length; ++i) {
      sow(ANVIL_ADDR_1, initialPlots[i].plotStart, initialPlots[i].beansSown, initialPlots[i].pods);
    }
    // Ensure setup was done correctly
    assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods);
    assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    assert.notInStore("Field", ANVIL_ADDR_2);
    assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);

    log.info("Initial data populated", []);
  });

  afterEach(() => {
    clearStore();
  });

  // Transfers entire first plot
  describe("Full Plot", () => {
    test("F: Unharvestable", () => {
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("F: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods, initialPlots[0].pods);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, ZERO_BI, initialPlots[0].pods);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("F: Harvestable (Partial)", () => {
      // 1/3 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));

      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods, harvestableAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods.minus(harvestableAmount), harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });

    test("F: Plot Source", () => {
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "TRANSFER");
    });
  });

  // Transfers the first third of the plot
  describe("Partial Plot: From Start", () => {
    test("S: Unharvestable", () => {
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(ANVIL_ADDR_1, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("S: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

      // Transfers first third of plot (only some of which is harvestable)
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

      const transferredUnharvestable = transferredAmount.minus(harvestableAmount);
      assertFarmerHasPlot(ANVIL_ADDR_1, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount), ZERO_BI);
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount, harvestableAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredUnharvestable, harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });

    test("S: Plot Source", () => {
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "TRANSFER");
      assert.fieldEquals("Plot", transferredIndex.plus(transferredAmount).toString(), "source", "SOW");
    });
  });

  // Transfers the final third of the plot
  describe("Partial Plot: To End", () => {
    test("E: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(ANVIL_ADDR_2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("E: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

    test("E: Plot Source", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", transferredIndex.toString(), "source", "TRANSFER");
    });
  });

  // Transfers the middle third of the plot
  describe("Partial Plot: Middle", () => {
    test("M: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);

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

    test("M: Plot Source", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(ANVIL_ADDR_1, ANVIL_ADDR_2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", transferredIndex.toString(), "source", "TRANSFER");
      assert.fieldEquals("Plot", transferredIndex.plus(transferredAmount).toString(), "source", "SOW");
    });
  });
});
