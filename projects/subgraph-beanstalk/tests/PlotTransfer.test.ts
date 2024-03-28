/// <reference path="../../../node_modules/assemblyscript/dist/assemblyscript.d.ts" />

import { beforeEach, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { BigInt } from "@graphprotocol/graph-ts";
import { createSowEvent, createPlotTransferEvent } from "./event-mocking/Field";

import { handleSow, handlePlotTransfer } from "../src/FieldHandler";
import { BEANSTALK } from "../src/utils/Constants";

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

const assertFarmerHasPlot = (farmer: string, index: BigInt, numPods: BigInt): void => {
  assert.fieldEquals("Plot", index.toString(), "farmer", farmer);
  assert.fieldEquals("Plot", index.toString(), "pods", numPods.toString());
};

// Field can be either a farmer or beanstalk address
const assertFieldHas = (field: string, unharvestable: BigInt, harvestable: BigInt): void => {
  assert.fieldEquals("Field", field, "unharvestablePods", unharvestable.toString());
  assert.fieldEquals("Field", field, "harvestablePods", harvestable.toString());
};

describe("Field: Plot Transfer", () => {
  beforeEach(() => {
    // Create two equally sized plots next to each other
    for (let i = 0; i < initialPlots.length; ++i) {
      handleSow(createSowEvent(ANVIL_ADDR_1, initialPlots[i].plotStart, initialPlots[i].beansSown, initialPlots[i].pods));
    }
    // Ensure setup was done correctly
    assertFarmerHasPlot(ANVIL_ADDR_1, initialPlots[0].plotStart, initialPlots[0].pods);
    assertFieldHas(ANVIL_ADDR_1, initialPlots[0].pods.plus(initialPlots[1].pods), BigInt.zero());
    assert.notInStore("Field", ANVIL_ADDR_2);
    assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), BigInt.zero());

    log.info("Initial data populated", []);
  });

  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  describe("Full Plot", () => {
    afterEach(() => {
      log.debug("Starting next test", []);
    });

    test("Unharvestable", () => {
      // Transfers entire first plot
      handlePlotTransfer(createPlotTransferEvent(ANVIL_ADDR_1, ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods));

      assertFarmerHasPlot(ANVIL_ADDR_2, initialPlots[0].plotStart, initialPlots[0].pods);
      assertFieldHas(ANVIL_ADDR_1, initialPlots[1].pods, BigInt.zero());
      assertFieldHas(ANVIL_ADDR_2, initialPlots[0].pods, BigInt.zero());
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), BigInt.zero());
    });
    test("Harvestable (Full)", () => {});
    test("Harvestable (Partial)", () => {});
  });

  describe("Partial Plot: From Start", () => {
    test("Unharvestable", () => {});
    test("Harvestable (Full)", () => {});
    test("Harvestable (Partial)", () => {});
  });

  describe("Partial Plot: Through End", () => {
    test("Unharvestable", () => {});
    test("Harvestable (Full)", () => {});
    test("Harvestable (Partial)", () => {});
  });

  describe("Partial Plot: Middle", () => {
    test("Unharvestable", () => {});
    test("Harvestable (Full)", () => {});
    test("Harvestable (Partial)", () => {});
  });
});
