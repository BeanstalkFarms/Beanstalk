import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, beforeAll, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handleSow } from "../src/FieldHandler";
import { handlePodListingCreated_v2 } from "../src/MarketplaceHandler";
import { handleAddDeposit, handleRemoveDeposit } from "../src/SiloHandler";
import { BEAN_ERC20 } from "../src/utils/Constants";
import { createSowEvent } from "./event-mocking/Field";
import { createPodListingCreatedEvent_v2 } from "./event-mocking/Marketplace";
import { createAddDepositEvent, createRemoveDepositEvent } from "./event-mocking/Silo";

let account = '0x1234567890abcdef1234567890abcdef12345678'.toLowerCase()
let listingIndex = BigInt.fromString('1000000000000')
let pricingFunction = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000012c000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001010101010101010101010101010000')

describe("Mocked Events", () => {
    beforeAll(() => {
        // Create a plot with the listing index
        let event = createSowEvent(
            account,
            listingIndex,
            BigInt.fromString('1000000000000'),
            BigInt.fromString('2000000000000')
        )
        handleSow(event)
    })

    describe("Marketplace v2", () => {
        test("Create a pod listing", () => {

            let event = createPodListingCreatedEvent_v2(
                account,
                listingIndex,
                BigInt.fromString('100000000000'),
                BigInt.fromString('500000000000'),
                BigInt.fromString('250000'),
                BigInt.fromString('300000000000000'),
                BigInt.fromString('10000000'),
                pricingFunction,
                BigInt.fromI32(0),
                BigInt.fromI32(1)
            )

            handlePodListingCreated_v2(event)

            let listingID = account + '-' + listingIndex.toString()

            assert.fieldEquals("PodListing", listingID, "plot", listingIndex.toString())
            assert.fieldEquals("PodListing", listingID, "farmer", account)
            assert.fieldEquals("PodListing", listingID, "status", 'ACTIVE')
            assert.fieldEquals("PodListing", listingID, "originalIndex", listingIndex.toString())
            assert.fieldEquals("PodListing", listingID, "index", listingIndex.toString())
            assert.fieldEquals("PodListing", listingID, "start", '100000000000')
            assert.fieldEquals("PodListing", listingID, "start", '100000000000')
            assert.fieldEquals("PodListing", listingID, "pricingFunction", pricingFunction.toHexString())
        })
    })
})
