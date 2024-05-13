import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handleSow } from "../src/FieldHandler";
import { handlePodListingCancelled, handlePodListingCreated_v2 } from "../src/MarketplaceHandler";
import { createSowEvent } from "./event-mocking/Field";
import { createPodListingCancelledEvent, createPodListingCreatedEvent_v2 } from "./event-mocking/Marketplace";
import { beans_BI, podlineMil_BI } from "../../subgraph-core/tests/Values";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { PodListingCreated as PodListingCreated_v2 } from "../generated/BIP29-PodMarketplace/Beanstalk";
import { BEANSTALK } from "../../subgraph-core/utils/Constants";
import { Sow } from "../generated/Field/Beanstalk";

let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
let listingIndex = podlineMil_BI(1);
let pricingFunction = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000012c000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001010101010101010101010101010000"
);

let sowedBeans = beans_BI(5000);
// 3x temp
let sowedPods = sowedBeans.times(BigInt.fromString("3"));

const sow = (account: string, index: BigInt, beans: BigInt, pods: BigInt): Sow => {
  const event = createSowEvent(account, index, beans, pods);
  handleSow(event);
  return event;
};

const createListing_v2 = (account: string, index: BigInt, plotTotalPods: BigInt, start: BigInt): PodListingCreated_v2 => {
  const event = createPodListingCreatedEvent_v2(
    account,
    index,
    start,
    plotTotalPods.minus(start),
    BigInt.fromString("250000"),
    BigInt.fromString("300000000000000"),
    BigInt.fromString("10000000"),
    pricingFunction,
    BigInt.fromI32(0),
    BigInt.fromI32(1)
  );
  handlePodListingCreated_v2(event);
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

const assertMarketState = (
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

describe("Marketplace", () => {
  beforeEach(() => {
    sow(account, listingIndex, sowedBeans, sowedPods);
  });

  afterEach(() => {
    clearStore();
  });

  // TODO tests:
  // cancel listing - full
  // cancel listing - partial
  // create order
  // cancel order - full
  // cancel order - partial
  // fill listing - full
  // fill listing - partial
  // fill order - full
  // fill order - partial

  describe("Marketplace v1", () => {
    test("Create a pod listing - full plot", () => {
      // const
    });

    test("Create a pod listing - partial plot", () => {});
  });

  describe("Marketplace v2", () => {
    test("Create a pod listing - full plot", () => {
      const event = createListing_v2(account, listingIndex, sowedPods, ZERO_BI);
      assertListingCreated_v2(event);
      assertMarketState(BEANSTALK.toHexString(), [listingIndex], sowedPods, sowedPods, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI);

      // Create a second listing to assert the market state again
      const listing2Index = listingIndex.times(BI_10);
      sow(account, listing2Index, sowedBeans, sowedPods);
      const event2 = createListing_v2(account, listing2Index, sowedPods, ZERO_BI);
      assertListingCreated_v2(event2);
      assertMarketState(
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
      assertListingCreated_v2(event);
      assertMarketState(BEANSTALK.toHexString(), [listingIndex], listedPods, listedPods, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI);
    });

    describe("Tests requiring listing", () => {
      beforeEach(() => {
        const event = createListing_v2(account, listingIndex, sowedPods, beans_BI(500));
      });

      test("Fill listing - full", () => {});

      test("Fill listing - partial", () => {});

      // Cancellation isnt unique to pod market v2, consider including in the v1 section
      test("Cancel pod listing - full", () => {
        const event = createPodListingCancelledEvent(account, listingIndex);
        handlePodListingCancelled(event);

        const listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
        assert.fieldEquals("PodListing", listingID, "status", "CANCELLED");
        assert.fieldEquals("PodListing", listingID, "cancelledAmount", sowedPods.minus(beans_BI(500)).toString());
        assert.fieldEquals("PodListing", listingID, "remainingAmount", "0");
      });

      test("Cancel pod listing - partial", () => {
        // TODO: some sold already
        const event = createPodListingCancelledEvent(account, listingIndex);
        handlePodListingCancelled(event);
      });
    });
  });
});
