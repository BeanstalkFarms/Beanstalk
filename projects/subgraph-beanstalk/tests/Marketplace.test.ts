import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handleSow } from "../src/FieldHandler";
import {
  handlePodListingCancelled,
  handlePodListingCreated_v2,
  handlePodListingFilled_v2,
  handlePodOrderCreated_v2
} from "../src/MarketplaceHandler";
import { createSowEvent } from "./event-mocking/Field";
import {
  createPodListingCancelledEvent,
  createPodListingCreatedEvent_v2,
  createPodListingFilledEvent_v2,
  createPodOrderCreatedEvent_v2
} from "./event-mocking/Marketplace";
import { beans_BI, podlineMil_BI } from "../../subgraph-core/tests/Values";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import {
  PodListingCreated as PodListingCreated_v2,
  PodListingFilled as PodListingFilled_v2,
  PodOrderCreated as PodOrderCreated_v2,
  PodOrderFilled as PodOrderFilled_v2
} from "../generated/BIP29-PodMarketplace/Beanstalk";
import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import { Sow } from "../generated/Field/Beanstalk";

const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();
const account2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();
const pricingFunction = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000012c000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001010101010101010101010101010000"
);

const listingIndex = podlineMil_BI(1);
const maxHarvestableIndex = podlineMil_BI(100);
const sowedBeans = beans_BI(5000);
const sowedPods = sowedBeans.times(BigInt.fromString("3"));

const orderBeans = beans_BI(80000);
const orderPricePerPod = BigInt.fromString("500000"); // 0.5 beans

const sow = (account: string, index: BigInt, beans: BigInt, pods: BigInt): Sow => {
  const event = createSowEvent(account, index, beans, pods);
  handleSow(event);
  return event;
};

const fillListing_v2 = (listingIndex: BigInt, listingStart: BigInt, podAmount: BigInt, costInBeans: BigInt): PodListingFilled_v2 => {
  const event = createPodListingFilledEvent_v2(account, account2, listingIndex, listingStart, podAmount, costInBeans);
  handlePodListingFilled_v2(event);

  // Assert PodFill
  const podFillId = BEANSTALK.toHexString() + "-" + listingIndex.toString() + "-" + event.transaction.hash.toHexString();
  assert.fieldEquals("PodFill", podFillId, "listing", event.params.from.toHexString() + "-" + listingIndex.toString());
  assert.fieldEquals("PodFill", podFillId, "from", account);
  assert.fieldEquals("PodFill", podFillId, "to", account2);
  assert.fieldEquals("PodFill", podFillId, "amount", podAmount.toString());
  assert.fieldEquals("PodFill", podFillId, "index", listingIndex.toString());
  assert.fieldEquals("PodFill", podFillId, "start", listingStart.toString());
  assert.fieldEquals("PodFill", podFillId, "costInBeans", costInBeans.toString());

  return event;
};

const assertListingCreated_v2 = (event: PodListingCreated_v2): void => {
  let listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
  assert.fieldEquals("PodListing", listingID, "plot", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "farmer", event.params.account.toHexString());
  assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
  assert.fieldEquals("PodListing", listingID, "originalIndex", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "originalAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "index", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "start", event.params.start.toString());
  assert.fieldEquals("PodListing", listingID, "amount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "remainingAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodListing", listingID, "maxHarvestableIndex", event.params.maxHarvestableIndex.toString());
  assert.fieldEquals("PodListing", listingID, "minFillAmount", event.params.minFillAmount.toString());
  assert.fieldEquals("PodListing", listingID, "pricingFunction", event.params.pricingFunction.toHexString());
  assert.fieldEquals("PodListing", listingID, "mode", event.params.mode.toString());
  assert.fieldEquals("PodListing", listingID, "pricingType", event.params.pricingType.toString());
};

const assertOrderCreated_v2 = (event: PodOrderCreated_v2): void => {
  let orderID = event.params.id.toHexString();
  assert.fieldEquals("PodOrder", orderID, "historyID", orderID + "-" + event.block.timestamp.toString());
  assert.fieldEquals("PodOrder", orderID, "farmer", account);
  assert.fieldEquals("PodOrder", orderID, "status", "ACTIVE");
  assert.fieldEquals("PodOrder", orderID, "beanAmount", event.params.amount.toString());
  assert.fieldEquals("PodOrder", orderID, "beanAmountFilled", "0");
  assert.fieldEquals("PodOrder", orderID, "minFillAmount", event.params.minFillAmount.toString());
  assert.fieldEquals("PodOrder", orderID, "maxPlaceInLine", event.params.maxPlaceInLine.toString());
  assert.fieldEquals("PodOrder", orderID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodOrder", orderID, "pricingFunction", event.params.pricingFunction.toHexString());
  assert.fieldEquals("PodOrder", orderID, "pricingType", event.params.priceType.toString());
};

const createListing_v2 = (account: string, index: BigInt, plotTotalPods: BigInt, start: BigInt): PodListingCreated_v2 => {
  const event = createPodListingCreatedEvent_v2(
    account,
    index,
    start,
    plotTotalPods.minus(start),
    BigInt.fromString("250000"),
    maxHarvestableIndex,
    BigInt.fromString("10000000"),
    pricingFunction,
    BigInt.fromI32(0),
    BigInt.fromI32(1)
  );
  handlePodListingCreated_v2(event);
  assertListingCreated_v2(event);
  return event;
};

const createOrder_v2 = (beans: BigInt, pricePerPod: BigInt): PodOrderCreated_v2 => {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(beans.plus(pricePerPod)));
  const event = createPodOrderCreatedEvent_v2(account, id, beans, pricePerPod, maxHarvestableIndex, ONE_BI, pricingFunction, ZERO_BI);
  handlePodOrderCreated_v2(event);
  assertOrderCreated_v2(event);
  return event;
};

const assertMarketListingsState = (
  address: string,
  listings: BigInt[],
  listedPods: BigInt,
  availableListedPods: BigInt,
  cancelledListedPods: BigInt,
  filledListedPods: BigInt,
  podVolume: BigInt,
  beanVolume: BigInt
): void => {
  assert.fieldEquals("PodMarketplace", address, "listingIndexes", "[" + listings.join(", ") + "]");
  assert.fieldEquals("PodMarketplace", address, "listedPods", listedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "availableListedPods", availableListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "cancelledListedPods", cancelledListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "filledListedPods", filledListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "podVolume", podVolume.toString());
  assert.fieldEquals("PodMarketplace", address, "beanVolume", beanVolume.toString());
};

const assertMarketOrdersState = (
  address: string,
  orders: string[],
  orderBeans: BigInt,
  filledOrderBeans: BigInt,
  filledOrderedPods: BigInt,
  cancelledOrderBeans: BigInt,
  podVolume: BigInt,
  beanVolume: BigInt
): void => {
  assert.fieldEquals("PodMarketplace", address, "orders", "[" + orders.join(", ") + "]");
  // TODO: re-enable these once implemented
  // assert.fieldEquals("PodMarketplace", address, "orderBeans", orderBeans.toString());
  // assert.fieldEquals("PodMarketplace", address, "filledOrderBeans", filledOrderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "filledOrderedPods", filledOrderedPods.toString());
  // assert.fieldEquals("PodMarketplace", address, "cancelledOrderBeans", cancelledOrderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "podVolume", podVolume.toString());
  assert.fieldEquals("PodMarketplace", address, "beanVolume", beanVolume.toString());
};

describe("Marketplace", () => {
  beforeEach(() => {
    sow(account, listingIndex, sowedBeans, sowedPods);
  });

  afterEach(() => {
    clearStore();
  });

  // TODO tests:
  // cancel order - full
  // cancel order - partial
  // fill order - full
  // fill order - partial
  // fill order with pods that are also listed
  // listing expires due to podline advancing
  // order expires due to podline advancing
  // re-list pods (historical listing)
  // re-order pods (historical order)

  // describe("Marketplace v1", () => {
  //   test("Create a pod listing - full plot", () => {});
  //   test("Create a pod listing - partial plot", () => {});
  // });

  describe("Marketplace v2", () => {
    test("Create a pod listing - full plot", () => {
      const event = createListing_v2(account, listingIndex, sowedPods, ZERO_BI);
      assertMarketListingsState(BEANSTALK.toHexString(), [listingIndex], sowedPods, sowedPods, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI);

      // Create a second listing to assert the market state again
      const listing2Index = listingIndex.times(BI_10);
      sow(account, listing2Index, sowedBeans, sowedPods);
      const event2 = createListing_v2(account, listing2Index, sowedPods, ZERO_BI);
      assertMarketListingsState(
        BEANSTALK.toHexString(),
        [listingIndex, listing2Index],
        sowedPods.times(BigInt.fromI32(2)),
        sowedPods.times(BigInt.fromI32(2)),
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );
    });

    test("Create a pod listing - partial plot", () => {
      const event = createListing_v2(account, listingIndex, sowedPods, beans_BI(500));
      const listedPods = sowedPods.minus(beans_BI(500));
      assertMarketListingsState(BEANSTALK.toHexString(), [listingIndex], listedPods, listedPods, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI);
    });

    test("Create a pod order", () => {
      const event = createOrder_v2(orderBeans, orderPricePerPod);
      assertMarketListingsState(BEANSTALK.toHexString(), [], ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI);
      assertMarketOrdersState(
        BEANSTALK.toHexString(),
        [event.params.id.toHexString()],
        orderBeans,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
        ZERO_BI
      );
    });

    describe("Tests requiring listing", () => {
      beforeEach(() => {
        const event = createListing_v2(account, listingIndex, sowedPods, beans_BI(500));
      });

      test("Fill listing - full", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledBeans = beans_BI(7000);
        const event = fillListing_v2(listingIndex, listingStart, listedPods, filledBeans);

        let listingID = event.params.from.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "FILLED");
        assert.fieldEquals("PodListing", listingID, "filledAmount", listedPods.toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");
        assert.fieldEquals("PodListing", listingID, "filled", listedPods.toString());
        assert.entityCount("PodListing", 1);

        assertMarketListingsState(BEANSTALK.toHexString(), [], listedPods, ZERO_BI, ZERO_BI, listedPods, listedPods, filledBeans);
      });

      test("Fill listing - partial, then full", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const event = fillListing_v2(listingIndex, listingStart, filledPods, filledBeans);

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
          [newListingIndex],
          listedPods,
          remaining,
          ZERO_BI,
          filledPods,
          filledPods,
          filledBeans
        );

        // Now sell the rest
        const newFilledBeans = beans_BI(4000);
        const event2 = fillListing_v2(newListingIndex, ZERO_BI, remaining, newFilledBeans);

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
          listedPods,
          listedPods,
          filledBeans.plus(newFilledBeans)
        );
      });

      // Cancellation isnt unique to pod market v2, consider including in the v1 section
      test("Cancel pod listing - full", () => {
        const event = createPodListingCancelledEvent(account, listingIndex);
        handlePodListingCancelled(event);

        const cancelledAmount = sowedPods.minus(beans_BI(500));
        const listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "CANCELLED");
        assert.fieldEquals("PodListing", listingID, "cancelledAmount", cancelledAmount.toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");

        assertMarketListingsState(BEANSTALK.toHexString(), [], cancelledAmount, ZERO_BI, cancelledAmount, ZERO_BI, ZERO_BI, ZERO_BI);
      });

      test("Cancel pod listing - partial", () => {
        const listingStart = beans_BI(500);
        const listedPods = sowedPods.minus(listingStart);
        const filledPods = listedPods.div(BigInt.fromString("4"));
        const filledBeans = beans_BI(2000);
        const fillEvent = fillListing_v2(listingIndex, listingStart, filledPods, filledBeans);

        const remaining = listedPods.minus(filledPods);
        const newListingIndex = fillEvent.params.index.plus(listingStart).plus(filledPods);

        const event = createPodListingCancelledEvent(account, newListingIndex);
        handlePodListingCancelled(event);

        const newListingID = event.params.account.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", newListingID, "status", "CANCELLED_PARTIAL");
        assert.fieldEquals("PodListing", newListingID, "cancelledAmount", remaining.toString());
        assert.fieldEquals("PodListing", newListingID, "remainingAmount", "0");

        assertMarketListingsState(BEANSTALK.toHexString(), [], listedPods, ZERO_BI, remaining, filledPods, filledPods, filledBeans);
      });
    });
  });
});
