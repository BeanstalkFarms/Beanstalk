import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    PodListingCancelled,
    PodListingCreated as PodListingCreated_v1,
    PodListingFilled as PodListingFilled_v1,
    PodOrderCancelled,
    PodOrderCreated as PodOrderCreated_v1,
    PodOrderFilled as PodOrderFilled_v1
} from "../generated/Field/Beanstalk";
import { PodListingCreated as PodListingCreated_v1_1 } from "../generated/Marketplace-Replanted/Beanstalk";
import {
    PodListingCreated as PodListingCreated_v2,
    PodListingFilled as PodListingFilled_v2,
    PodOrderCreated as PodOrderCreated_v2,
    PodOrderFilled as PodOrderFilled_v2
} from "../generated/BIP29-PodMarketplace/Beanstalk";

import {
    Plot,
    PodListingCreated as PodListingCreatedEvent,
    PodListingFilled as PodListingFilledEvent,
    PodListingCancelled as PodListingCancelledEvent,
    PodOrderCreated as PodOrderCreatedEvent,
    PodOrderFilled as PodOrderFilledEvent,
    PodOrderCancelled as PodOrderCancelledEvent
} from "../generated/schema";
import { toDecimal, ZERO_BI } from "./utils/Decimals";
import { loadFarmer } from "./utils/Farmer";
import { loadPlot } from "./utils/Plot";
import { loadPodFill } from "./utils/PodFill";
import { createHistoricalPodListing, loadPodListing } from "./utils/PodListing";
import { loadPodMarketplace, loadPodMarketplaceDailySnapshot, loadPodMarketplaceHourlySnapshot } from "./utils/PodMarketplace";
import { createHistoricalPodOrder, loadPodOrder } from "./utils/PodOrder";

/* ------------------------------------
 * POD MARKETPLACE V1
 * 
 * Proposal: BIP-11 https://bean.money/bip-11
 * Deployed: 02/05/2022 @ block 14148509
 * Code: https://github.com/BeanstalkFarms/Beanstalk/commit/75a67fc94cf2637ac1d7d7c89645492e31423fed
 * ------------------------------------
 */

export function handlePodListingCreated(event: PodListingCreated_v1): void {
    let plotCheck = Plot.load(event.params.index.toString())
    if (plotCheck == null) { return }
    let plot = loadPlot(event.address, event.params.index)

    /// Upsert pod listing
    let listing = loadPodListing(event.params.account, event.params.index)
    if (listing.createdAt !== ZERO_BI) {
        createHistoricalPodListing(listing)
        listing.status = 'ACTIVE'
        listing.createdAt = ZERO_BI
        listing.fill = null
        listing.filled = ZERO_BI
        listing.filledAmount = ZERO_BI
        listing.cancelledAmount = ZERO_BI
    }

    // Identifiers
    listing.historyID = listing.id + '-' + event.block.timestamp.toString()
    listing.plot = plot.id

    // Configuration
    listing.start = event.params.start
    listing.mode = event.params.toWallet === true ? 0 : 1

    // Constraints
    listing.maxHarvestableIndex = event.params.maxHarvestableIndex

    // Pricing
    listing.pricePerPod = event.params.pricePerPod

    // Amounts [Relative to Original]
    listing.originalIndex = event.params.index
    listing.originalAmount = event.params.amount

    // Amounts [Relative to Child]
    listing.amount = event.params.amount // in Pods
    listing.remainingAmount = listing.originalAmount

    // Metadata
    listing.createdAt = listing.createdAt == ZERO_BI ? event.block.timestamp : listing.createdAt
    listing.updatedAt = event.block.timestamp
    listing.creationHash = event.transaction.hash.toHexString()
    listing.save()

    /// Update plot
    plot.listing = listing.id
    plot.save()

    /// Update market totals
    updateMarketListingBalances(event.address, plot.index, event.params.amount, ZERO_BI, ZERO_BI, ZERO_BI, event.block.timestamp)

    /// Save raw event data
    let id = 'podListingCreated-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingCreatedEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = listing.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.pricePerPod = event.params.pricePerPod
    rawEvent.maxHarvestableIndex = event.params.maxHarvestableIndex
    rawEvent.minFillAmount = ZERO_BI
    rawEvent.mode = event.params.toWallet
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodListingCancelled(event: PodListingCancelled): void {

    let listing = loadPodListing(event.params.account, event.params.index)

    updateMarketListingBalances(event.address, event.params.index, ZERO_BI, ZERO_BI, ZERO_BI, listing.remainingAmount, event.block.timestamp)

    listing.status = 'CANCELLED'
    listing.cancelledAmount = listing.remainingAmount
    listing.remainingAmount = ZERO_BI
    listing.updatedAt = event.block.timestamp
    listing.save()

    // Save the raw event data
    let id = 'podListingCancelled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingCancelledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = listing.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.index = event.params.index
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodListingFilled(event: PodListingFilled_v1): void {

    let listing = loadPodListing(event.params.from, event.params.index)

    let beanAmount = BigInt.fromI32(listing.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000))

    updateMarketListingBalances(event.address, event.params.index, ZERO_BI, ZERO_BI, event.params.amount, beanAmount, event.block.timestamp)

    listing.filledAmount = event.params.amount
    listing.remainingAmount = listing.remainingAmount.minus(event.params.amount)
    listing.filled = listing.filled.plus(event.params.amount)
    listing.updatedAt = event.block.timestamp

    let originalHistoryID = listing.historyID
    if (listing.remainingAmount == ZERO_BI) {
        listing.status = 'FILLED'
    } else {
        let market = loadPodMarketplace(event.address)

        listing.status = 'FILLED_PARTIAL'
        let remainingListing = loadPodListing(Address.fromString(listing.farmer), listing.index.plus(event.params.amount).plus(listing.start))

        remainingListing.historyID = remainingListing.id + '-' + event.block.timestamp.toString()
        remainingListing.plot = listing.index.plus(event.params.amount).plus(listing.start).toString()
        remainingListing.createdAt = listing.createdAt
        remainingListing.updatedAt = event.block.timestamp
        remainingListing.originalIndex = listing.originalIndex
        remainingListing.start = ZERO_BI
        remainingListing.amount = listing.remainingAmount
        remainingListing.originalAmount = listing.originalAmount
        remainingListing.filled = listing.filled
        remainingListing.remainingAmount = listing.remainingAmount
        remainingListing.pricePerPod = listing.pricePerPod
        remainingListing.maxHarvestableIndex = listing.maxHarvestableIndex
        remainingListing.mode = listing.mode
        remainingListing.creationHash = event.transaction.hash.toHexString()
        remainingListing.save()
        market.listingIndexes.push(remainingListing.index)
        market.save()
    }

    /// Save pod fill
    let fill = loadPodFill(event.address, event.params.index, event.transaction.hash.toHexString())
    fill.createdAt = event.block.timestamp
    fill.listing = listing.id
    fill.from = event.params.from.toHexString()
    fill.to = event.params.to.toHexString()
    fill.amount = event.params.amount
    fill.index = event.params.index
    fill.start = event.params.start
    fill.costInBeans = beanAmount
    fill.save()

    listing.fill = fill.id
    listing.save()

    // Save the raw event data
    let id = 'podListingFilled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingFilledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = originalHistoryID
    rawEvent.from = event.params.from.toHexString()
    rawEvent.to = event.params.to.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodOrderCreated(event: PodOrderCreated_v1): void {
    let order = loadPodOrder(event.params.id)
    let farmer = loadFarmer(event.params.account)

    if (order.status != '') { createHistoricalPodOrder(order) }

    order.historyID = order.id + '-' + event.block.timestamp.toString()
    order.farmer = event.params.account.toHexString()
    order.createdAt = event.block.timestamp
    order.updatedAt = event.block.timestamp
    order.status = 'ACTIVE'
    order.podAmount = event.params.amount
    order.beanAmount = event.params.amount.times(BigInt.fromI32(event.params.pricePerPod)).div(BigInt.fromString('1000000'))
    order.podAmountFilled = ZERO_BI
    order.maxPlaceInLine = event.params.maxPlaceInLine
    order.pricePerPod = event.params.pricePerPod
    order.creationHash = event.transaction.hash.toHexString()
    order.save()

    updateMarketOrderBalances(event.address, order.id, event.params.amount, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.block.timestamp)

    // Save the raw event data
    let id = 'podOrderCreated-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodOrderCreatedEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = order.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.orderId = event.params.id.toHexString()
    rawEvent.amount = event.params.amount
    rawEvent.pricePerPod = event.params.pricePerPod
    rawEvent.maxPlaceInLine = event.params.maxPlaceInLine
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodOrderFilled(event: PodOrderFilled_v1): void {
    let order = loadPodOrder(event.params.id)
    let fill = loadPodFill(event.address, event.params.index, event.transaction.hash.toHexString())

    let beanAmount = BigInt.fromI32(order.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000))

    order.updatedAt = event.block.timestamp
    order.podAmountFilled = order.podAmountFilled.plus(event.params.amount)
    order.beanAmountFilled = order.beanAmountFilled.plus(beanAmount)
    order.status = order.podAmount == order.podAmountFilled ? 'FILLED' : 'ACTIVE'
    let newFills = order.fills
    newFills.push(fill.id)
    order.fills = newFills
    order.save()

    fill.createdAt = event.block.timestamp
    fill.order = order.id
    fill.from = event.params.from.toHexString()
    fill.to = event.params.to.toHexString()
    fill.amount = event.params.amount
    fill.index = event.params.index
    fill.start = event.params.start
    fill.costInBeans = beanAmount
    fill.save()

    updateMarketOrderBalances(event.address, order.id, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.params.amount, beanAmount, event.block.timestamp)

    if (order.podAmountFilled == order.podAmount) {
        let market = loadPodMarketplace(event.address)

        let orderIndex = market.orders.indexOf(order.id)
        if (orderIndex !== -1) {
            market.orders.splice(orderIndex, 1)
        }
        market.save()
    }

    // Save the raw event data
    let id = 'podOrderFilled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodOrderFilledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = order.historyID
    rawEvent.from = event.params.from.toHexString()
    rawEvent.to = event.params.to.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodOrderCancelled(event: PodOrderCancelled): void {
    let order = loadPodOrder(event.params.id)

    order.status = order.podAmountFilled == ZERO_BI ? 'CANCELLED' : 'CANCELLED_PARTIAL'
    order.updatedAt = event.block.timestamp
    order.save()

    updateMarketOrderBalances(event.address, order.id, ZERO_BI, order.podAmount.minus(order.podAmountFilled), ZERO_BI, order.beanAmount.minus(order.beanAmountFilled), ZERO_BI, ZERO_BI, event.block.timestamp)

    // Save the raw event data
    let id = 'podOrderCancelled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodOrderCancelledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = order.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.orderId = event.params.id.toHexString()
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

/* ------------------------------------
 * POD MARKETPLACE V1 - REPLANTED
 * 
 * When Beanstalk was Replanted, `event.params.mode` was changed from
 * `bool` to `uint8`. 
 * 
 * Proposal: ...
 * Deployed: ... at block 15277986
 * ------------------------------------
 */

export function handlePodListingCreated_v1_1(event: PodListingCreated_v1_1): void {
    let plotCheck = Plot.load(event.params.index.toString())
    if (plotCheck == null) { return }
    let plot = loadPlot(event.address, event.params.index)

    /// Upsert pod listing
    let listing = loadPodListing(event.params.account, event.params.index)
    if (listing.createdAt !== ZERO_BI) {
        createHistoricalPodListing(listing)
        listing.status = 'ACTIVE'
        listing.createdAt = ZERO_BI
        listing.fill = null
        listing.filled = ZERO_BI
        listing.filledAmount = ZERO_BI
        listing.cancelledAmount = ZERO_BI
    }

    listing.historyID = listing.id + '-' + event.block.timestamp.toString()
    listing.plot = plot.id

    listing.start = event.params.start
    listing.mode = event.params.mode

    listing.pricePerPod = event.params.pricePerPod
    listing.maxHarvestableIndex = event.params.maxHarvestableIndex

    listing.originalIndex = event.params.index
    listing.originalAmount = event.params.amount

    listing.amount = event.params.amount
    listing.remainingAmount = listing.originalAmount

    listing.status = 'ACTIVE'
    listing.createdAt = listing.createdAt == ZERO_BI ? event.block.timestamp : listing.createdAt
    listing.updatedAt = event.block.timestamp
    listing.creationHash = event.transaction.hash.toHexString()

    listing.save()

    /// Update plot
    plot.listing = listing.id
    plot.save()

    /// Update market totals
    updateMarketListingBalances(event.address, plot.index, event.params.amount, ZERO_BI, ZERO_BI, ZERO_BI, event.block.timestamp)

    /// Save raw event data
    let id = 'podListingCreated-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingCreatedEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = listing.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.pricePerPod = event.params.pricePerPod
    rawEvent.maxHarvestableIndex = event.params.maxHarvestableIndex
    rawEvent.maxHarvestableIndex = ZERO_BI
    rawEvent.minFillAmount = ZERO_BI
    rawEvent.mode = event.params.mode
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

/* ------------------------------------
 * POD MARKETPLACE V2
 * 
 * Proposal: BIP-29 https://bean.money/bip-29
 * Deployed: 11/12/2022 @ block 15277986
 * ------------------------------------
 */

export function handlePodListingCreated_v2(event: PodListingCreated_v2): void {

    let plotCheck = Plot.load(event.params.index.toString())
    if (plotCheck == null) { return }
    let plot = loadPlot(event.address, event.params.index)

    /// Upsert PodListing
    let listing = loadPodListing(event.params.account, event.params.index)
    if (listing.createdAt !== ZERO_BI) {
        // Re-listed prior plot with new info
        createHistoricalPodListing(listing)
        listing.status = 'ACTIVE'
        listing.createdAt = ZERO_BI
        listing.fill = null
        listing.filled = ZERO_BI
        listing.filledAmount = ZERO_BI
        listing.cancelledAmount = ZERO_BI
    }

    listing.historyID = listing.id + '-' + event.block.timestamp.toString()
    listing.plot = plot.id

    listing.start = event.params.start
    listing.mode = event.params.mode

    listing.minFillAmount = event.params.minFillAmount
    listing.maxHarvestableIndex = event.params.maxHarvestableIndex

    listing.pricingType = event.params.pricingType
    listing.pricePerPod = event.params.pricePerPod
    listing.pricingFunction = event.params.pricingFunction

    listing.originalIndex = event.params.index
    listing.originalAmount = event.params.amount

    listing.amount = event.params.amount
    listing.remainingAmount = listing.originalAmount

    listing.status = 'ACTIVE'
    listing.createdAt = listing.createdAt == ZERO_BI ? event.block.timestamp : listing.createdAt
    listing.updatedAt = event.block.timestamp
    listing.creationHash = event.transaction.hash.toHexString()

    listing.save()

    /// Update plot
    plot.listing = listing.id
    plot.save()

    /// Update market totals
    updateMarketListingBalances(event.address, plot.index, event.params.amount, ZERO_BI, ZERO_BI, ZERO_BI, event.block.timestamp)

    /// Save  raw event data
    let id = 'podListingCreated-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingCreatedEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = listing.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.pricePerPod = event.params.pricePerPod
    rawEvent.maxHarvestableIndex = event.params.maxHarvestableIndex
    rawEvent.minFillAmount = event.params.minFillAmount
    rawEvent.mode = event.params.mode
    rawEvent.pricingFunction = event.params.pricingFunction
    rawEvent.pricingType = event.params.pricingType
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodListingFilled_v2(event: PodListingFilled_v2): void {

    let listing = loadPodListing(event.params.from, event.params.index)

    updateMarketListingBalances(event.address, event.params.index, ZERO_BI, ZERO_BI, event.params.amount, event.params.costInBeans, event.block.timestamp)

    listing.filledAmount = event.params.amount
    listing.remainingAmount = listing.remainingAmount.minus(event.params.amount)
    listing.filled = listing.filled.plus(event.params.amount)
    listing.updatedAt = event.block.timestamp

    let originalHistoryID = listing.historyID
    if (listing.remainingAmount == ZERO_BI) {
        listing.status = 'FILLED'
    } else {
        let market = loadPodMarketplace(event.address)

        listing.status = 'FILLED_PARTIAL'
        let remainingListing = loadPodListing(Address.fromString(listing.farmer), listing.index.plus(event.params.amount).plus(listing.start))

        remainingListing.historyID = remainingListing.id + '-' + event.block.timestamp.toString()
        remainingListing.plot = listing.index.plus(event.params.amount).plus(listing.start).toString()
        remainingListing.createdAt = listing.createdAt
        remainingListing.updatedAt = event.block.timestamp
        remainingListing.originalIndex = listing.originalIndex
        remainingListing.start = ZERO_BI
        remainingListing.amount = listing.remainingAmount
        remainingListing.originalAmount = listing.originalAmount
        remainingListing.filled = listing.filled
        remainingListing.remainingAmount = listing.remainingAmount
        remainingListing.pricePerPod = listing.pricePerPod
        remainingListing.maxHarvestableIndex = listing.maxHarvestableIndex
        remainingListing.mode = listing.mode
        remainingListing.creationHash = event.transaction.hash.toHexString()
        remainingListing.save()
        market.listingIndexes.push(remainingListing.index)
        market.save()
    }

    let fill = loadPodFill(event.address, event.params.index, event.transaction.hash.toHexString())
    fill.createdAt = event.block.timestamp
    fill.listing = listing.id
    fill.from = event.params.from.toHexString()
    fill.to = event.params.to.toHexString()
    fill.amount = event.params.amount
    fill.index = event.params.index
    fill.start = event.params.start
    fill.costInBeans = event.params.costInBeans
    fill.save()

    listing.fill = fill.id
    listing.save()

    // Save the raw event data
    let id = 'podListingFilled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodListingFilledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = originalHistoryID
    rawEvent.from = event.params.from.toHexString()
    rawEvent.to = event.params.to.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.costInBeans = event.params.costInBeans
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodOrderCreated_v2(event: PodOrderCreated_v2): void {
    let order = loadPodOrder(event.params.id)
    let farmer = loadFarmer(event.params.account)

    if (order.status != '') { createHistoricalPodOrder(order) }

    // Store the pod amount if the order is a FIXED pricingType
    if (event.params.priceType == 0) { order.podAmount = event.params.amount.times(BigInt.fromI32(1000000)).div(BigInt.fromI32(event.params.pricePerPod)) }

    order.historyID = order.id + '-' + event.block.timestamp.toString()
    order.farmer = event.params.account.toHexString()
    order.createdAt = event.block.timestamp
    order.updatedAt = event.block.timestamp
    order.status = 'ACTIVE'
    order.beanAmount = event.params.amount
    order.beanAmountFilled = ZERO_BI
    order.minFillAmount = event.params.minFillAmount
    order.maxPlaceInLine = event.params.maxPlaceInLine
    order.pricePerPod = event.params.pricePerPod
    order.pricingFunction = event.params.pricingFunction
    order.pricingType = event.params.priceType
    order.creationHash = event.transaction.hash.toHexString()
    order.save()

    updateMarketOrderBalances(event.address, order.id, ZERO_BI, ZERO_BI, event.params.amount, ZERO_BI, ZERO_BI, ZERO_BI, event.block.timestamp)

    // Save the raw event data
    let id = 'podOrderCreated-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodOrderCreatedEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = order.historyID
    rawEvent.account = event.params.account.toHexString()
    rawEvent.orderId = event.params.id.toHexString()
    rawEvent.amount = event.params.amount
    rawEvent.pricePerPod = event.params.pricePerPod
    rawEvent.maxPlaceInLine = event.params.maxPlaceInLine
    rawEvent.pricingFunction = event.params.pricingFunction
    rawEvent.pricingType = event.params.priceType
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

export function handlePodOrderFilled_v2(event: PodOrderFilled_v2): void {
    let order = loadPodOrder(event.params.id)
    let fill = loadPodFill(event.address, event.params.index, event.transaction.hash.toHexString())

    order.updatedAt = event.block.timestamp
    order.beanAmountFilled = order.beanAmountFilled.plus(event.params.costInBeans)
    order.podAmountFilled = order.podAmountFilled.plus(event.params.amount)
    order.status = order.beanAmount == order.beanAmountFilled ? 'FILLED' : 'ACTIVE'
    let newFills = order.fills
    newFills.push(fill.id)
    order.fills = newFills
    order.save()

    fill.createdAt = event.block.timestamp
    fill.order = order.id
    fill.from = event.params.from.toHexString()
    fill.to = event.params.to.toHexString()
    fill.amount = event.params.amount
    fill.index = event.params.index
    fill.start = event.params.start
    fill.costInBeans = event.params.costInBeans
    fill.save()

    updateMarketOrderBalances(event.address, order.id, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, event.params.amount, event.params.costInBeans, event.block.timestamp)

    if (order.beanAmountFilled == order.beanAmount) {
        let market = loadPodMarketplace(event.address)

        let orderIndex = market.orders.indexOf(order.id)
        if (orderIndex !== -1) {
            market.orders.splice(orderIndex, 1)
        }
        market.save()
    }

    // Save the raw event data
    let id = 'podOrderFilled-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let rawEvent = new PodOrderFilledEvent(id)
    rawEvent.hash = event.transaction.hash.toHexString()
    rawEvent.logIndex = event.logIndex.toI32()
    rawEvent.protocol = event.address.toHexString()
    rawEvent.historyID = order.historyID
    rawEvent.from = event.params.from.toHexString()
    rawEvent.to = event.params.to.toHexString()
    rawEvent.index = event.params.index
    rawEvent.start = event.params.start
    rawEvent.amount = event.params.amount
    rawEvent.costInBeans = event.params.costInBeans
    rawEvent.blockNumber = event.block.number
    rawEvent.createdAt = event.block.timestamp
    rawEvent.save()
}

/* ------------------------------------
 * SHARED FUNCTIONS
 * ------------------------------------
 */

function updateMarketListingBalances(
    marketAddress: Address,
    plotIndex: BigInt,
    newPodAmount: BigInt,
    cancelledPodAmount: BigInt,
    filledPodAmount: BigInt,
    filledBeanAmount: BigInt,
    timestamp: BigInt
): void {
    let market = loadPodMarketplace(marketAddress)
    let marketHourly = loadPodMarketplaceHourlySnapshot(marketAddress, market.season, timestamp)
    let marketDaily = loadPodMarketplaceDailySnapshot(marketAddress, timestamp)

    // Update Listing indexes
    if (newPodAmount > ZERO_BI) {
        market.listingIndexes.push(plotIndex)
        market.listingIndexes.sort()
    }
    if (cancelledPodAmount > ZERO_BI || filledPodAmount > ZERO_BI) {
        let listingIndex = market.listingIndexes.indexOf(plotIndex)
        market.listingIndexes.splice(listingIndex, 1)
    }
    market.listedPods = market.listedPods.plus(newPodAmount)
    market.availableListedPods = market.availableListedPods.plus(newPodAmount).minus(cancelledPodAmount).minus(filledPodAmount)
    market.cancelledListedPods = market.cancelledListedPods.plus(cancelledPodAmount)
    market.filledListedPods = market.filledListedPods.plus(filledPodAmount)
    market.podVolume = market.podVolume.plus(filledPodAmount)
    market.beanVolume = market.beanVolume.plus(filledBeanAmount)
    market.save()

    marketHourly.season = market.season
    marketHourly.deltaListedPods = marketHourly.deltaListedPods.plus(newPodAmount)
    marketHourly.listedPods = market.listedPods
    marketHourly.deltaCancelledListedPods = marketHourly.deltaCancelledListedPods.plus(cancelledPodAmount)
    marketHourly.cancelledListedPods = market.cancelledListedPods
    marketHourly.deltaAvailableListedPods = marketHourly.deltaAvailableListedPods.plus(newPodAmount).minus(cancelledPodAmount).minus(filledPodAmount)
    marketHourly.availableListedPods = market.availableListedPods
    marketHourly.deltaFilledListedPods = marketHourly.deltaFilledListedPods.plus(filledPodAmount)
    marketHourly.filledListedPods = market.filledListedPods
    marketHourly.deltaPodVolume = marketHourly.deltaPodVolume.plus(filledPodAmount)
    marketHourly.podVolume = market.podVolume
    marketHourly.deltaBeanVolume = marketHourly.deltaBeanVolume.plus(filledBeanAmount)
    marketHourly.beanVolume = market.beanVolume
    marketHourly.updatedAt = timestamp
    marketHourly.save()

    marketDaily.season = market.season
    marketDaily.deltaListedPods = marketDaily.deltaListedPods.plus(newPodAmount)
    marketDaily.listedPods = market.listedPods
    marketDaily.deltaCancelledListedPods = marketDaily.deltaCancelledListedPods.plus(cancelledPodAmount)
    marketDaily.cancelledListedPods = market.cancelledListedPods
    marketDaily.deltaAvailableListedPods = marketDaily.deltaAvailableListedPods.plus(newPodAmount).minus(cancelledPodAmount).minus(filledPodAmount)
    marketDaily.availableListedPods = market.availableListedPods
    marketDaily.deltaFilledListedPods = marketDaily.deltaFilledListedPods.plus(filledPodAmount)
    marketDaily.filledListedPods = market.filledListedPods
    marketDaily.deltaPodVolume = marketDaily.deltaPodVolume.plus(filledPodAmount)
    marketDaily.podVolume = market.podVolume
    marketDaily.deltaBeanVolume = marketDaily.deltaBeanVolume.plus(filledBeanAmount)
    marketDaily.beanVolume = market.beanVolume
    marketDaily.updatedAt = timestamp
    marketDaily.save()
}

function updateMarketOrderBalances(
    marketAddress: Address,
    orderID: string,
    newPodAmount: BigInt,
    cancelledPodAmount: BigInt,
    newBeanAmount: BigInt,
    cancelledBeanAmount: BigInt,
    filledPodAmount: BigInt,
    filledBeanAmount: BigInt,
    timestamp: BigInt
): void {
    // Need to account for v2 bean amounts

    let market = loadPodMarketplace(marketAddress)
    let marketHourly = loadPodMarketplaceHourlySnapshot(marketAddress, market.season, timestamp)
    let marketDaily = loadPodMarketplaceDailySnapshot(marketAddress, timestamp)

    if (newPodAmount > ZERO_BI) {
        market.orders.push(orderID)
    }
    if (cancelledPodAmount > ZERO_BI) {
        let orderIndex = market.orders.indexOf(orderID)
        market.listingIndexes.splice(orderIndex, 1)
    }
    market.orderedPods = market.orderedPods.plus(newPodAmount)
    market.filledOrderedPods = market.filledOrderedPods.plus(filledPodAmount)
    market.podVolume = market.podVolume.plus(filledPodAmount)
    market.beanVolume = market.beanVolume.plus(filledBeanAmount)
    market.cancelledOrderedPods = market.cancelledOrderedPods.plus(cancelledPodAmount)
    market.save()

    marketHourly.deltaOrderedPods = marketHourly.deltaOrderedPods.plus(newPodAmount)
    marketHourly.orderedPods = market.orderedPods
    marketHourly.deltaFilledOrderedPods = marketHourly.deltaFilledOrderedPods.plus(filledPodAmount)
    marketHourly.filledOrderedPods = market.filledOrderedPods
    marketHourly.deltaPodVolume = marketHourly.deltaPodVolume.plus(filledPodAmount)
    marketHourly.podVolume = market.podVolume
    marketHourly.deltaBeanVolume = marketHourly.deltaBeanVolume.plus(filledBeanAmount)
    marketHourly.beanVolume = market.beanVolume
    marketHourly.deltaCancelledOrderedPods = marketHourly.deltaCancelledOrderedPods.plus(cancelledPodAmount)
    marketHourly.cancelledOrderedPods = market.cancelledOrderedPods
    marketHourly.updatedAt = timestamp
    marketHourly.save()

    marketDaily.deltaOrderedPods = marketDaily.deltaOrderedPods.plus(newPodAmount)
    marketDaily.orderedPods = market.orderedPods
    marketDaily.deltaFilledOrderedPods = marketDaily.deltaFilledOrderedPods.plus(filledPodAmount)
    marketDaily.filledOrderedPods = market.filledOrderedPods
    marketDaily.deltaPodVolume = marketDaily.deltaPodVolume.plus(filledPodAmount)
    marketDaily.podVolume = market.podVolume
    marketDaily.deltaBeanVolume = marketDaily.deltaBeanVolume.plus(filledBeanAmount)
    marketDaily.beanVolume = market.beanVolume
    marketDaily.deltaCancelledOrderedPods = marketDaily.deltaCancelledOrderedPods.plus(cancelledPodAmount)
    marketDaily.cancelledOrderedPods = market.cancelledOrderedPods
    marketDaily.updatedAt = timestamp
    marketDaily.save()
}
