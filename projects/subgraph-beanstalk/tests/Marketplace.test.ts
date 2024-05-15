import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handlePodListingCancelled, handlePodOrderCancelled } from "../src/MarketplaceHandler";
import { createPodListingCancelledEvent, createPodOrderCancelledEvent } from "./event-mocking/Marketplace";
import { beans_BI, podlineMil_BI } from "../../subgraph-core/tests/Values";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import {
  assertMarketListingsState,
  assertMarketOrdersState,
  createListing_v2,
  createOrder_v2,
  fillListing_v2,
  fillOrder_v2,
  getPodFillId
} from "./utils/Marketplace";
import { harvest, setHarvestable, sow } from "./utils/Field";

const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();
const account2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();

const listingIndex = podlineMil_BI(1);
const maxHarvestableIndex = podlineMil_BI(100);
const sowedBeans = beans_BI(5000);
const sowedPods = sowedBeans.times(BigInt.fromString("3"));

const orderBeans = beans_BI(80000);
const orderPricePerPod = BigInt.fromString("500000"); // 0.5 beans
const orderId = Bytes.fromHexString("0xabcd");

describe("Marketplace", () => {
  beforeEach(() => {
    sow(account, listingIndex, sowedBeans, sowedPods);
  });

  afterEach(() => {
    clearStore();
  });

  // TODO tests:
  // fill order with pods that are also listed
  // order expires due to podline advancing

  describe("Marketplace v2", () => {
    test("Create a pod listing - full plot", () => {
      const event = createListing_v2(account, listingIndex, sowedPods, ZERO_BI, maxHarvestableIndex);
      assertMarketListingsState(
        BEANSTALK.toHexString(),
        [account + "-" + listingIndex.toString() + "-" + maxHarvestableIndex.toString()],
        sowedPods,
        sowedPods,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );

      // Create a second listing to assert the market state again
      const listing2Index = listingIndex.times(BI_10);
      sow(account, listing2Index, sowedBeans, sowedPods);
      const event2 = createListing_v2(account, listing2Index, sowedPods, ZERO_BI, maxHarvestableIndex);
      assertMarketListingsState(
        BEANSTALK.toHexString(),
        [
          account + "-" + listingIndex.toString() + "-" + maxHarvestableIndex.toString(),
          account + "-" + listing2Index.toString() + "-" + maxHarvestableIndex.toString()
        ],
        sowedPods.times(BigInt.fromI32(2)),
        sowedPods.times(BigInt.fromI32(2)),
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );
    });

    test("Create a pod listing - partial plot", () => {
      const event = createListing_v2(account, listingIndex, sowedPods, beans_BI(500), maxHarvestableIndex);
      const listedPods = sowedPods.minus(beans_BI(500));
      assertMarketListingsState(
        BEANSTALK.toHexString(),
        [account + "-" + listingIndex.toString() + "-" + maxHarvestableIndex.toString()],
        listedPods,
        listedPods,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );
    });

    test("Create a pod order", () => {
      const event = createOrder_v2(account, orderId, orderBeans, orderPricePerPod, maxHarvestableIndex);
      assertMarketOrdersState(
        BEANSTALK.toHexString(),
        [event.params.id.toHexString() + "-" + maxHarvestableIndex.toString()],
        orderBeans,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );
    });

    describe("Tests requiring Listing", () => {
      beforeEach(() => {
        createListing_v2(account, listingIndex, sowedPods, beans_BI(500), maxHarvestableIndex);
      });

      test("Fill listing - full", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledBeans = beans_BI(7000);
        const event = fillListing_v2(account, account2, listingIndex, listingStart, listedPods, filledBeans);

        let listingID = event.params.from.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "FILLED");
        assert.fieldEquals("PodListing", listingID, "filledAmount", listedPods.toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");
        assert.fieldEquals("PodListing", listingID, "filled", listedPods.toString());
        assert.entityCount("PodListing", 1);

        assertMarketListingsState(BEANSTALK.toHexString(), [], listedPods, ZERO_BI, ZERO_BI, ZERO_BI, listedPods, listedPods, filledBeans);
      });

      test("Fill listing - partial, then full", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const event = fillListing_v2(account, account2, listingIndex, listingStart, filledPods, filledBeans);

        const remaining = listedPods.minus(filledPods);
        const listingID = event.params.from.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "FILLED_PARTIAL");
        assert.fieldEquals("PodListing", listingID, "filledAmount", filledPods.toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", remaining.toString());
        assert.fieldEquals("PodListing", listingID, "filled", filledPods.toString());
        assert.entityCount("PodListing", 2);

        const newListingIndex = event.params.index.plus(listingStart).plus(filledPods);
        const derivedListingID = event.params.from.toHexString() + "-" + newListingIndex.toString();
        assert.fieldEquals("PodListing", derivedListingID, "status", "ACTIVE");
        assert.fieldEquals("PodListing", derivedListingID, "filledAmount", "0");
        assert.fieldEquals("PodListing", derivedListingID, "remainingAmount", remaining.toString());
        assert.fieldEquals("PodListing", derivedListingID, "originalIndex", listingIndex.toString());
        assert.fieldEquals("PodListing", derivedListingID, "originalAmount", listedPods.toString());
        assert.fieldEquals("PodListing", derivedListingID, "filled", filledPods.toString());

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [account + "-" + newListingIndex.toString() + "-" + maxHarvestableIndex.toString()],
          listedPods,
          remaining,
          ZERO_BI,
          ZERO_BI,
          filledPods,
          filledPods,
          filledBeans
        );

        // Now sell the rest
        const newFilledBeans = beans_BI(4000);
        const event2 = fillListing_v2(account, account2, newListingIndex, ZERO_BI, remaining, newFilledBeans);

        assert.entityCount("PodListing", 2);
        assert.fieldEquals("PodListing", derivedListingID, "status", "FILLED");
        assert.fieldEquals("PodListing", derivedListingID, "filledAmount", remaining.toString());
        assert.fieldEquals("PodListing", derivedListingID, "remainingAmount", "0");
        assert.fieldEquals("PodListing", derivedListingID, "filled", listedPods.toString());
        // Original should be unchanged
        assert.fieldEquals("PodListing", listingID, "status", "FILLED_PARTIAL");
        assert.fieldEquals("PodListing", listingID, "filled", filledPods.toString());

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [],
          listedPods,
          ZERO_BI,
          ZERO_BI,
          ZERO_BI,
          listedPods,
          listedPods,
          filledBeans.plus(newFilledBeans)
        );
      });

      // Cancellation isnt unique to pod market v2, consider including in the v1 section
      test("Cancel listing - full", () => {
        const event = createPodListingCancelledEvent(account, listingIndex);
        handlePodListingCancelled(event);

        const cancelledAmount = sowedPods.minus(beans_BI(500));
        const listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "CANCELLED");
        assert.fieldEquals("PodListing", listingID, "cancelledAmount", cancelledAmount.toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [],
          cancelledAmount,
          ZERO_BI,
          cancelledAmount,
          ZERO_BI,
          ZERO_BI,
          ZERO_BI,
          ZERO_BI
        );
      });

      test("Cancel listing - partial", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const fillEvent = fillListing_v2(account, account2, listingIndex, listingStart, filledPods, filledBeans);

        const remaining = listedPods.minus(filledPods);
        const newListingIndex = fillEvent.params.index.plus(listingStart).plus(filledPods);

        const event = createPodListingCancelledEvent(account, newListingIndex);
        handlePodListingCancelled(event);

        const newListingID = event.params.account.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", newListingID, "status", "CANCELLED_PARTIAL");
        assert.fieldEquals("PodListing", newListingID, "cancelledAmount", remaining.toString());
        assert.fieldEquals("PodListing", newListingID, "remainingAmount", "0");

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [],
          listedPods,
          ZERO_BI,
          remaining,
          ZERO_BI,
          filledPods,
          filledPods,
          filledBeans
        );
      });

      test("Recreate listing", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        handlePodListingCancelled(createPodListingCancelledEvent(account, listingIndex));
        const listEvent = createListing_v2(account, listingIndex, sowedPods, listingStart, maxHarvestableIndex);

        const listingID = listEvent.params.account.toHexString() + "-" + listEvent.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
        assert.fieldEquals("PodListing", listingID + "-0", "status", "CANCELLED");
        assert.fieldEquals("PodListing", listingID + "-0", "filled", "0");
        assert.fieldEquals("PodListing", listingID + "-0", "cancelledAmount", listedPods.toString());

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [account + "-" + listingIndex.toString() + "-" + maxHarvestableIndex.toString()],
          listedPods.times(BigInt.fromU32(2)),
          listedPods,
          listedPods,
          ZERO_BI,
          ZERO_BI,
          ZERO_BI,
          ZERO_BI
        );

        // Partial fill, then recreate again
        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const fillEvent = fillListing_v2(account, account2, listingIndex, listingStart, filledPods, filledBeans);

        const remaining = listedPods.minus(filledPods);
        const newListingIndex = fillEvent.params.index.plus(listingStart).plus(filledPods);
        const newListingAmount = listedPods.minus(filledPods);
        handlePodListingCancelled(createPodListingCancelledEvent(account, newListingIndex));
        const newListEvent = createListing_v2(account, newListingIndex, remaining, ZERO_BI, maxHarvestableIndex);

        const newListingID = newListEvent.params.account.toHexString() + "-" + newListEvent.params.index.toString();
        assert.notInStore("PodListing", listingID + "-1");
        assert.notInStore("PodListing", newListingID + "-1");
        assert.fieldEquals("PodListing", newListingID + "-0", "status", "CANCELLED_PARTIAL");
        assert.fieldEquals("PodListing", newListingID + "-0", "filled", filledPods.toString());
        assert.fieldEquals("PodListing", newListingID + "-0", "cancelledAmount", newListingAmount.toString());
        assert.fieldEquals("PodListing", newListingID, "status", "ACTIVE");
        assert.fieldEquals("PodListing", newListingID, "filled", "0");
        assert.fieldEquals("PodListing", newListingID, "remainingAmount", newListingAmount.toString());

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [account + "-" + newListingIndex.toString() + "-" + maxHarvestableIndex.toString()],
          listedPods.times(BigInt.fromU32(2)).plus(newListingAmount),
          newListingAmount,
          listedPods.plus(newListingAmount),
          ZERO_BI,
          filledPods,
          filledPods,
          filledBeans
        );
      });

      test("Listing expires due to moving podline", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const listingID = account + "-" + listingIndex.toString();
        assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
        assert.fieldEquals("PodListing", listingID, "maxHarvestableIndex", maxHarvestableIndex.toString());

        // Expires due to exceeding max harvestable index
        setHarvestable(maxHarvestableIndex);
        assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
        setHarvestable(maxHarvestableIndex.plus(ONE_BI));
        assert.fieldEquals("PodListing", listingID, "status", "EXPIRED");
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");

        assertMarketListingsState(BEANSTALK.toHexString(), [], listedPods, ZERO_BI, ZERO_BI, listedPods, ZERO_BI, ZERO_BI, ZERO_BI);

        // Test expiration after a partial sale
        setHarvestable(maxHarvestableIndex);
        createListing_v2(account, listingIndex, sowedPods, beans_BI(500), maxHarvestableIndex);

        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const fillEvent = fillListing_v2(account, account2, listingIndex, listingStart, filledPods, filledBeans);

        const remaining = listedPods.minus(filledPods);
        const newListingIndex = fillEvent.params.index.plus(listingStart).plus(filledPods);
        const newListingID = account + "-" + newListingIndex.toString();

        setHarvestable(maxHarvestableIndex.plus(ONE_BI));
        assert.fieldEquals("PodListing", listingID, "status", "FILLED_PARTIAL");
        assert.fieldEquals("PodListing", listingID, "filled", filledPods.toString());
        assert.fieldEquals("PodListing", newListingID, "status", "EXPIRED");
        assert.fieldEquals("PodListing", newListingID, "filled", filledPods.toString());
        assert.fieldEquals("PodListing", newListingID, "remainingAmount", "0");

        assertMarketListingsState(
          BEANSTALK.toHexString(),
          [],
          listedPods.times(BigInt.fromU32(2)),
          ZERO_BI,
          ZERO_BI,
          listedPods.plus(remaining),
          filledPods,
          filledPods,
          filledBeans
        );
      });

      test("Listing expires due to plot harvesting", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const listingID = account + "-" + listingIndex.toString();
        assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");

        // Plot is harvestable, but still active
        setHarvestable(listingIndex.plus(sowedPods));
        assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
        // Plot harvests, now expired
        harvest(account, [listingIndex], sowedPods);
        assert.fieldEquals("PodListing", listingID, "status", "EXPIRED");
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");
      });
    });

    describe("Tests requiring Order", () => {
      beforeEach(() => {
        createOrder_v2(account, orderId, orderBeans, orderPricePerPod, maxHarvestableIndex);
      });

      test("Fill order - full", () => {
        const orderPlotIndex = podlineMil_BI(15);
        const orderedPods = orderBeans.times(BigInt.fromU32(1000000)).div(orderPricePerPod);
        sow(account2, orderPlotIndex, sowedBeans, orderedPods);
        const event = fillOrder_v2(account2, account, orderId, orderPlotIndex, ZERO_BI, orderedPods, orderBeans);

        assert.fieldEquals("PodOrder", orderId.toHexString(), "status", "FILLED");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "beanAmountFilled", orderBeans.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "podAmountFilled", orderedPods.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "fills", "[" + getPodFillId(orderPlotIndex, event) + "]");

        assertMarketOrdersState(BEANSTALK.toHexString(), [], orderBeans, orderBeans, orderedPods, ZERO_BI, orderedPods, orderBeans);
      });

      test("Fill order - partial", () => {
        const orderPlotIndex = podlineMil_BI(15);
        const orderedPods = orderBeans.times(BigInt.fromU32(1000000)).div(orderPricePerPod);
        const soldToOrder1 = orderedPods.div(BigInt.fromU32(5));
        const orderBeans1 = orderBeans.div(BigInt.fromU32(5));
        sow(account2, orderPlotIndex, sowedBeans, orderedPods.times(BigInt.fromU32(2)));
        const event = fillOrder_v2(account2, account, orderId, orderPlotIndex, beans_BI(1000), soldToOrder1, orderBeans1);

        assert.fieldEquals("PodOrder", orderId.toHexString(), "status", "ACTIVE");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "beanAmountFilled", orderBeans1.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "podAmountFilled", soldToOrder1.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "fills", "[" + getPodFillId(orderPlotIndex, event) + "]");

        assertMarketOrdersState(
          BEANSTALK.toHexString(),
          [event.params.id.toHexString() + "-" + maxHarvestableIndex.toString()],
          orderBeans,
          orderBeans1,
          soldToOrder1,
          ZERO_BI,
          soldToOrder1,
          orderBeans1
        );

        // Now fill the rest
        const newOrderPlotIndex = orderPlotIndex.plus(beans_BI(1000)).plus(soldToOrder1);
        const soldToOrder2 = orderedPods.minus(soldToOrder1);
        const orderBeans2 = orderBeans.minus(orderBeans1);
        const event2 = fillOrder_v2(account2, account, orderId, newOrderPlotIndex, ZERO_BI, soldToOrder2, orderBeans2);

        assert.fieldEquals("PodOrder", orderId.toHexString(), "status", "FILLED");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "beanAmountFilled", orderBeans.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "podAmountFilled", orderedPods.toString());
        assert.fieldEquals(
          "PodOrder",
          orderId.toHexString(),
          "fills",
          "[" + getPodFillId(orderPlotIndex, event) + ", " + getPodFillId(newOrderPlotIndex, event2) + "]"
        );

        assertMarketOrdersState(BEANSTALK.toHexString(), [], orderBeans, orderBeans, orderedPods, ZERO_BI, orderedPods, orderBeans);
      });

      test("Cancel order - full", () => {
        const event = createPodOrderCancelledEvent(account, orderId);
        handlePodOrderCancelled(event);

        assert.fieldEquals("PodOrder", orderId.toHexString(), "status", "CANCELLED");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "beanAmountFilled", "0");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "podAmountFilled", "0");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "fills", "[]");

        assertMarketOrdersState(BEANSTALK.toHexString(), [], orderBeans, ZERO_BI, ZERO_BI, orderBeans, ZERO_BI, ZERO_BI);
      });

      test("Cancel order - partial", () => {
        const orderPlotIndex = podlineMil_BI(15);
        const orderedPods = orderBeans.times(BigInt.fromU32(1000000)).div(orderPricePerPod);
        const soldToOrder1 = orderedPods.div(BigInt.fromU32(5));
        const orderBeans1 = orderBeans.div(BigInt.fromU32(5));
        sow(account2, orderPlotIndex, sowedBeans, orderedPods.times(BigInt.fromU32(2)));
        const fillEvent = fillOrder_v2(account2, account, orderId, orderPlotIndex, beans_BI(1000), soldToOrder1, orderBeans1);

        const event = createPodOrderCancelledEvent(account, orderId);
        handlePodOrderCancelled(event);

        assert.fieldEquals("PodOrder", orderId.toHexString(), "status", "CANCELLED_PARTIAL");
        assert.fieldEquals("PodOrder", orderId.toHexString(), "beanAmountFilled", orderBeans1.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "podAmountFilled", soldToOrder1.toString());
        assert.fieldEquals("PodOrder", orderId.toHexString(), "fills", "[" + getPodFillId(orderPlotIndex, fillEvent) + "]");

        assertMarketOrdersState(
          BEANSTALK.toHexString(),
          [],
          orderBeans,
          orderBeans1,
          soldToOrder1,
          orderBeans.minus(orderBeans1),
          soldToOrder1,
          orderBeans1
        );
      });

      test("Recreate order", () => {
        handlePodOrderCancelled(createPodOrderCancelledEvent(account, orderId));
        createOrder_v2(account, orderId, orderBeans, orderPricePerPod, maxHarvestableIndex);

        assert.fieldEquals("PodOrder", orderId.toHexString() + "-0", "fills", "[]");

        assertMarketOrdersState(
          BEANSTALK.toHexString(),
          [orderId.toHexString() + "-" + maxHarvestableIndex.toString()],
          orderBeans.times(BigInt.fromU32(2)),
          ZERO_BI,
          ZERO_BI,
          orderBeans,
          ZERO_BI,
          ZERO_BI
        );

        // Recreate after a partial fill
        const orderPlotIndex = podlineMil_BI(15);
        const orderedPods = orderBeans.times(BigInt.fromU32(1000000)).div(orderPricePerPod);
        const soldToOrder1 = orderedPods.div(BigInt.fromU32(5));
        const orderBeans1 = orderBeans.div(BigInt.fromU32(5));
        sow(account2, orderPlotIndex, sowedBeans, orderedPods.times(BigInt.fromU32(2)));
        const fillEvent = fillOrder_v2(account2, account, orderId, orderPlotIndex, beans_BI(1000), soldToOrder1, orderBeans1);

        handlePodOrderCancelled(createPodOrderCancelledEvent(account, orderId));
        createOrder_v2(account, orderId, orderBeans, orderPricePerPod, maxHarvestableIndex);

        // The historical order has one fill
        assert.fieldEquals("PodOrder", orderId.toHexString() + "-1", "fills", "[" + getPodFillId(orderPlotIndex, fillEvent) + "]");
        // The recreated order has no fills
        assert.fieldEquals("PodOrder", orderId.toHexString(), "fills", "[]");

        // The same amount of beans were re-ordered, but fewer were cancelled
        assertMarketOrdersState(
          BEANSTALK.toHexString(),
          [orderId.toHexString() + "-" + maxHarvestableIndex.toString()],
          orderBeans.times(BigInt.fromU32(3)),
          orderBeans1,
          soldToOrder1,
          orderBeans.plus(orderBeans.minus(orderBeans1)),
          soldToOrder1,
          orderBeans1
        );
      });
    });
  });
});
