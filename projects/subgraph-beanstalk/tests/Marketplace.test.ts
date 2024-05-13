import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handleSow } from "../src/FieldHandler";
import { handlePodListingCreated_v2 } from "../src/MarketplaceHandler";
import { createSowEvent } from "./event-mocking/Field";
import { createPodListingCreatedEvent_v2 } from "./event-mocking/Marketplace";
import { beans_BI, podlineMil_BI } from "../../subgraph-core/tests/Values";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { PodListingCreated as PodListingCreated_v2 } from "../generated/BIP29-PodMarketplace/Beanstalk";

let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
let listingIndex = podlineMil_BI(1);
let pricingFunction = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000012c000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001010101010101010101010101010000"
);

let sowedBeans = beans_BI(5000);
// 3x temp
let sowedPods = sowedBeans.times(BigInt.fromString("3"));

const assertListingCreated_v2 = (event: PodListingCreated_v2): void => {
  let listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
  assert.entityCount("PodListing", 1);
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

describe("Marketplace", () => {
  beforeEach(() => {
    // Create a plot with the listing index
    let event = createSowEvent(account, listingIndex, sowedBeans, sowedPods);
    handleSow(event);
  });

  afterEach(() => {
    clearStore();
  });

  // TODO tests:
  // create listing - full
  // create listing - partial
  // cancel listing
  // create order
  // cancel order
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
      const event = createPodListingCreatedEvent_v2(
        account,
        listingIndex,
        ZERO_BI,
        sowedBeans,
        BigInt.fromString("550000"),
        BigInt.fromString("200000000000000"),
        BigInt.fromString("5000000"),
        pricingFunction,
        BigInt.fromI32(1),
        BigInt.fromI32(0)
      );
      handlePodListingCreated_v2(event);
      assertListingCreated_v2(event);
    });

    test("Create a pod listing - partial plot", () => {
      const start = beans_BI(500);
      const event = createPodListingCreatedEvent_v2(
        account,
        listingIndex,
        start,
        sowedBeans.minus(start),
        BigInt.fromString("250000"),
        BigInt.fromString("300000000000000"),
        BigInt.fromString("10000000"),
        pricingFunction,
        BigInt.fromI32(0),
        BigInt.fromI32(1)
      );
      handlePodListingCreated_v2(event);
      assertListingCreated_v2(event);
    });
  });
});
