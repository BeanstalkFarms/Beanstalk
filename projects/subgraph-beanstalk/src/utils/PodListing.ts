import { Address, BigInt } from "@graphprotocol/graph-ts";
import { PodListing } from "../../generated/schema";
import { BEANSTALK } from "./Constants";
import { ZERO_BI } from "./Decimals";
import { loadPlot } from "./Plot";
import { loadPodMarketplace, loadPodMarketplaceDailySnapshot, loadPodMarketplaceHourlySnapshot } from "./PodMarketplace";

export function loadPodListing(account: Address, index: BigInt): PodListing {
    let id = account.toHexString() + '-' + index.toString()
    let listing = PodListing.load(id)

    if (listing == null) {
        listing = new PodListing(id)
        listing.podMarketplace = BEANSTALK.toHexString()
        listing.historyID = ''
        listing.plot = index.toString()
        listing.farmer = account.toHexString()

        listing.index = index
        listing.start = ZERO_BI
        listing.mode = 0

        listing.maxHarvestableIndex = ZERO_BI
        listing.minFillAmount = ZERO_BI

        listing.pricePerPod = 0

        listing.originalIndex = index
        listing.originalAmount = ZERO_BI
        listing.filled = ZERO_BI

        listing.amount = ZERO_BI
        listing.remainingAmount = ZERO_BI
        listing.filledAmount = ZERO_BI
        listing.cancelledAmount = ZERO_BI

        listing.status = 'ACTIVE'
        listing.createdAt = ZERO_BI
        listing.creationHash = ''
        listing.updatedAt = ZERO_BI

        listing.save()
    }
    
    return listing
}

export function expirePodListing(diamondAddress: Address, timestamp: BigInt, listingIndex: BigInt): void {
    let market = loadPodMarketplace(diamondAddress)
    let marketHourly = loadPodMarketplaceHourlySnapshot(diamondAddress, market.season, timestamp)
    let marketDaily = loadPodMarketplaceDailySnapshot(diamondAddress, timestamp)
    //farmer info
    let plot = loadPlot(diamondAddress, listingIndex)
    let listing = loadPodListing(Address.fromString(plot.farmer), listingIndex)

    market.expiredListedPods = market.expiredListedPods.plus(listing.remainingAmount)
    market.availableListedPods = market.availableListedPods.minus(listing.remainingAmount)
    market.save()

    marketHourly.season = market.season
    marketHourly.deltaExpiredListedPods = marketHourly.deltaExpiredListedPods.plus(listing.remainingAmount)
    marketHourly.expiredListedPods = market.expiredListedPods
    marketHourly.deltaAvailableListedPods = marketHourly.deltaAvailableListedPods.minus(listing.remainingAmount)
    marketHourly.availableListedPods = market.availableListedPods
    marketHourly.save()

    marketDaily.season = market.season
    marketDaily.deltaExpiredListedPods = marketDaily.deltaExpiredListedPods.plus(listing.remainingAmount)
    marketDaily.expiredListedPods = market.expiredListedPods
    marketDaily.deltaAvailableListedPods = marketDaily.deltaAvailableListedPods.minus(listing.remainingAmount)
    marketDaily.availableListedPods = market.availableListedPods
    marketDaily.save()

    listing.status = 'EXPIRED'
    listing.remainingAmount = ZERO_BI
    listing.save()
}

export function createHistoricalPodListing(listing: PodListing): void {
    let created = false
    let id = listing.id
    for (let i = 0; !created; i++) {
        id = listing.id + '-' + i.toString()
        let newListing = PodListing.load(id)
        if (newListing == null) {
            newListing = new PodListing(id)
            newListing.podMarketplace = listing.podMarketplace
            newListing.historyID = listing.historyID
            newListing.plot = listing.plot
            newListing.farmer = listing.farmer

            newListing.index = listing.index
            newListing.start = listing.start
            newListing.mode = listing.mode

            newListing.maxHarvestableIndex = listing.maxHarvestableIndex
            newListing.minFillAmount = listing.minFillAmount

            newListing.pricePerPod = listing.pricePerPod

            newListing.originalIndex = listing.originalIndex
            newListing.originalAmount = listing.originalAmount
            newListing.filled = listing.filled

            newListing.amount = listing.amount
            newListing.remainingAmount = listing.remainingAmount
            newListing.filledAmount = listing.filledAmount
            newListing.cancelledAmount = listing.cancelledAmount

            newListing.fill = listing.fill

            newListing.status = listing.status
            newListing.createdAt = listing.createdAt
            newListing.updatedAt = listing.updatedAt
            newListing.creationHash = listing.creationHash
            newListing.save()
            created = true
        }
    }
}
