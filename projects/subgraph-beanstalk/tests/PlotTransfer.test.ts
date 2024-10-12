/// <reference path="../../../node_modules/assemblyscript/dist/assemblyscript.d.ts" />

import { beforeEach, afterEach, assert, clearStore, describe, test, createMockedFunction } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

import { BEANSTALK } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { beans_BI as beans, podlineMil_BI } from "../../subgraph-core/tests/Values";
import { assertFarmerHasPlot, assertFieldHas, setHarvestable, sow, transferPlot } from "./utils/Field";
import { createListing_v2, createOrder_v2, fillListing_v2, fillOrder_v2 } from "./utils/Marketplace";
import { initL1Version } from "./entity-mocking/MockVersion";

const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();
const account2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();

// 2 plots: each sow 500 for 7500 at 10m and 15m in line.
const plot1Start = podlineMil_BI(10);
const plot2Start = podlineMil_BI(15);
const beansSown = beans(500);
const temperature = 15;
const pods = beansSown.times(BigInt.fromI32(temperature));

const maxHarvestableIndex = podlineMil_BI(100);
const orderId = Bytes.fromHexString("0xabcd");

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
    initL1Version();

    // Create two equally sized plots next to each other
    for (let i = 0; i < initialPlots.length; ++i) {
      sow(account, initialPlots[i].plotStart, initialPlots[i].beansSown, initialPlots[i].pods);
    }
    // Ensure setup was done correctly
    assertFarmerHasPlot(account, initialPlots[0].plotStart, initialPlots[0].pods);
    assertFieldHas(account, initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    assert.notInStore("Field", account2);
    assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);

    log.info("Initial data populated", []);
  });

  afterEach(() => {
    clearStore();
  });

  // Transfers entire first plot
  describe("Full Plot", () => {
    test("F: Unharvestable", () => {
      transferPlot(account, account2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(account2, initialPlots[0].plotStart, initialPlots[0].pods);
      assertFieldHas(account, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(account2, initialPlots[0].pods, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("F: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      transferPlot(account, account2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(account2, initialPlots[0].plotStart, initialPlots[0].pods, initialPlots[0].pods);
      assertFieldHas(account, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(account2, ZERO_BI, initialPlots[0].pods);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("F: Harvestable (Partial)", () => {
      // 1/3 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));

      transferPlot(account, account2, initialPlots[0].plotStart, initialPlots[0].pods);

      assertFarmerHasPlot(account2, initialPlots[0].plotStart, initialPlots[0].pods, harvestableAmount);
      assertFieldHas(account, initialPlots[1].pods, ZERO_BI);
      assertFieldHas(account2, initialPlots[0].pods.minus(harvestableAmount), harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });

    test("F: Plot Source", () => {
      transferPlot(account, account2, initialPlots[0].plotStart, initialPlots[0].pods);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "TRANSFER");
    });

    test("F: Marketplace Listing", () => {
      const fillBeans = beans(7500);
      createListing_v2(account, initialPlots[0].plotStart, initialPlots[0].pods, ZERO_BI, maxHarvestableIndex);
      fillListing_v2(account, account2, initialPlots[0].plotStart, ZERO_BI, initialPlots[0].pods, fillBeans);

      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(initialPlots[0].pods).toString();
      assert.entityCount("Plot", 2);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "MARKET");
    });

    test("F: Marketplace Order", () => {
      const fillBeans = beans(8500);
      const orderPricePerPod = BigInt.fromString("1234");
      createOrder_v2(account, orderId, beans(10000), orderPricePerPod, maxHarvestableIndex);
      fillOrder_v2(account2, account, orderId, initialPlots[0].plotStart, ZERO_BI, initialPlots[0].pods, fillBeans);

      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(initialPlots[0].pods).toString();
      assert.entityCount("Plot", 2);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "MARKET");
    });
  });

  // Transfers the first third of the plot
  describe("Partial Plot: From Start", () => {
    test("S: Unharvestable", () => {
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(account, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount);
      assertFieldHas(account, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(account2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("S: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(
        account,
        transferredIndex.plus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount)
      );
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(account, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(account2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("S: Harvestable (Partial)", () => {
      // 1/4 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(4));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));

      // Transfers first third of plot (only some of which is harvestable)
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(account, account2, transferredIndex, transferredAmount);

      const transferredUnharvestable = transferredAmount.minus(harvestableAmount);
      assertFarmerHasPlot(account, transferredIndex.plus(transferredAmount), initialPlots[0].pods.minus(transferredAmount), ZERO_BI);
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, harvestableAmount);
      assertFieldHas(account, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(account2, transferredUnharvestable, harvestableAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });

    test("S: Plot Source", () => {
      const transferredIndex = initialPlots[0].plotStart;
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      transferPlot(account, account2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "TRANSFER");
      assert.fieldEquals("Plot", transferredIndex.plus(transferredAmount).toString(), "source", "SOW");
    });

    test("S: Marketplace Listing", () => {
      const listingAmount = initialPlots[0].pods.div(BigInt.fromI32(4));
      const fillBeans = beans(7500);
      createListing_v2(account, initialPlots[0].plotStart, listingAmount, ZERO_BI, maxHarvestableIndex);
      fillListing_v2(account, account2, initialPlots[0].plotStart, ZERO_BI, listingAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(listingAmount).toString();
      assert.entityCount("Plot", 3);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "MARKET");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingAmount).toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingAmount).toString(), "source", "SOW");
    });

    test("S: Marketplace Order", () => {
      const fillAmount = initialPlots[0].pods.div(BigInt.fromI32(4));
      const fillBeans = beans(8500);
      const orderPricePerPod = BigInt.fromString("1234");
      createOrder_v2(account, orderId, beans(10000), orderPricePerPod, maxHarvestableIndex);
      fillOrder_v2(account2, account, orderId, initialPlots[0].plotStart, ZERO_BI, fillAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(fillAmount).toString();
      assert.entityCount("Plot", 3);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "MARKET");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillAmount).toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillAmount).toString(), "source", "SOW");
    });
  });

  // Transfers the final third of the plot
  describe("Partial Plot: To End", () => {
    test("E: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(account, initialPlots[0].plotStart, initialPlots[0].pods.minus(transferredAmount));
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount);
      assertFieldHas(account, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(account2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("E: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(
        account,
        initialPlots[0].plotStart,
        initialPlots[0].pods.minus(transferredAmount),
        initialPlots[0].pods.minus(transferredAmount)
      );
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(account, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(account2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[1].pods, initialPlots[0].pods);
    });

    test("E: Harvestable (Partial)", () => {
      // 3/4 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.times(BigInt.fromI32(3)).div(BigInt.fromI32(4));
      const harvestableIndex = setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      const transferredHarvestable = harvestableIndex.minus(transferredIndex);
      assertFarmerHasPlot(
        account,
        initialPlots[0].plotStart,
        initialPlots[0].pods.minus(transferredAmount),
        harvestableAmount.minus(transferredHarvestable)
      );
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, transferredHarvestable);
      assertFieldHas(account, initialPlots[1].pods, harvestableAmount.minus(transferredHarvestable));
      assertFieldHas(account2, initialPlots[0].pods.minus(harvestableAmount), transferredHarvestable);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.minus(harvestableAmount).plus(initialPlots[1].pods), harvestableAmount);
    });

    test("E: Plot Source", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotEnd.minus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", transferredIndex.toString(), "source", "TRANSFER");
    });

    test("E: Marketplace Listing", () => {
      const listingStart = initialPlots[0].pods.div(BigInt.fromI32(3));
      const listingAmount = initialPlots[0].pods.minus(listingStart);
      const fillBeans = beans(5500);
      createListing_v2(account, initialPlots[0].plotStart, listingAmount, listingStart, maxHarvestableIndex);
      fillListing_v2(account, account2, initialPlots[0].plotStart, listingStart, listingAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(listingAmount).toString();
      assert.entityCount("Plot", 3);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingStart).toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingStart).toString(), "source", "MARKET");
    });

    test("E: Marketplace Order", () => {
      const fillStart = initialPlots[0].pods.div(BigInt.fromI32(3));
      const fillAmount = initialPlots[0].pods.minus(fillStart);
      const fillBeans = beans(5500);
      const orderPricePerPod = BigInt.fromString("1234");
      createOrder_v2(account, orderId, beans(10000), orderPricePerPod, maxHarvestableIndex);
      fillOrder_v2(account2, account, orderId, initialPlots[0].plotStart, fillStart, fillAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(fillAmount).toString();
      assert.entityCount("Plot", 3);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).toString(), "source", "MARKET");
    });
  });

  // Transfers the middle third of the plot
  describe("Partial Plot: Middle", () => {
    test("M: Unharvestable", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(account, initialPlots[0].plotStart, transferredAmount);
      assertFarmerHasPlot(account, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount);
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount);
      assertFieldHas(account, initialPlots[0].pods.minus(transferredAmount).plus(initialPlots[1].pods), ZERO_BI);
      assertFieldHas(account2, transferredAmount, ZERO_BI);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods), ZERO_BI);
    });

    test("M: Harvestable (Full)", () => {
      // Entire first plot is harvestable
      setHarvestable(initialPlots[0].plotStart.plus(initialPlots[0].pods));

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      assertFarmerHasPlot(account, initialPlots[0].plotStart, transferredAmount, transferredAmount);
      assertFarmerHasPlot(account, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount, transferredAmount);
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, transferredAmount);
      assertFieldHas(account, initialPlots[1].pods, initialPlots[0].pods.minus(transferredAmount));
      assertFieldHas(account2, ZERO_BI, transferredAmount);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods, initialPlots[1].pods);
    });

    test("M: Harvestable (Partial)", () => {
      // 1/2 of first plot is harvestable
      const harvestableAmount = initialPlots[0].pods.div(BigInt.fromI32(2));
      setHarvestable(initialPlots[0].plotStart.plus(harvestableAmount));

      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);

      const transferredHarvestable = harvestableAmount.minus(transferredAmount);
      assertFarmerHasPlot(account, initialPlots[0].plotStart, transferredAmount, harvestableAmount.minus(transferredHarvestable));
      assertFarmerHasPlot(account, initialPlots[0].plotEnd.minus(transferredAmount), transferredAmount, ZERO_BI);
      assertFarmerHasPlot(account2, transferredIndex, transferredAmount, transferredHarvestable);
      assertFieldHas(
        account,
        initialPlots[0].pods.minus(harvestableAmount).minus(transferredHarvestable).plus(initialPlots[1].pods),
        harvestableAmount.minus(transferredHarvestable)
      );
      assertFieldHas(account2, transferredHarvestable, transferredHarvestable);
      assertFieldHas(BEANSTALK.toHexString(), initialPlots[0].pods.plus(initialPlots[1].pods).minus(harvestableAmount), harvestableAmount);
    });

    test("M: Plot Source", () => {
      const transferredAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const transferredIndex = initialPlots[0].plotStart.plus(transferredAmount);
      transferPlot(account, account2, transferredIndex, transferredAmount);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", transferredIndex.toString(), "source", "TRANSFER");
      assert.fieldEquals("Plot", transferredIndex.plus(transferredAmount).toString(), "source", "SOW");
    });

    test("M: Marketplace Listing", () => {
      const listingStart = initialPlots[0].pods.div(BigInt.fromI32(3));
      const listingAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const fillBeans = beans(5500);
      createListing_v2(account, initialPlots[0].plotStart, listingAmount, listingStart, maxHarvestableIndex);
      fillListing_v2(account, account2, initialPlots[0].plotStart, listingStart, listingAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(listingAmount).toString();
      assert.entityCount("Plot", 4);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingStart).toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingStart).toString(), "source", "MARKET");
      assert.fieldEquals(
        "Plot",
        initialPlots[0].plotStart.plus(listingStart).plus(listingAmount).toString(),
        "beansPerPod",
        initialBeansPerPod
      );
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(listingStart).plus(listingAmount).toString(), "source", "SOW");
    });

    test("M: Marketplace Order", () => {
      const fillStart = initialPlots[0].pods.div(BigInt.fromI32(3));
      const fillAmount = initialPlots[0].pods.div(BigInt.fromI32(3));
      const fillBeans = beans(5500);
      const orderPricePerPod = BigInt.fromString("1234");
      createOrder_v2(account, orderId, beans(10000), orderPricePerPod, maxHarvestableIndex);
      fillOrder_v2(account2, account, orderId, initialPlots[0].plotStart, fillStart, fillAmount, fillBeans);

      const initialBeansPerPod = BI_10.pow(6).div(BigInt.fromU32(temperature)).toString();
      const filledBeansPerPod = fillBeans.times(BI_10.pow(6)).div(fillAmount).toString();
      assert.entityCount("Plot", 4);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.toString(), "source", "SOW");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).toString(), "beansPerPod", filledBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).toString(), "source", "MARKET");
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).plus(fillAmount).toString(), "beansPerPod", initialBeansPerPod);
      assert.fieldEquals("Plot", initialPlots[0].plotStart.plus(fillStart).plus(fillAmount).toString(), "source", "SOW");
    });
  });
});
