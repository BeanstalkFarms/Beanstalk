import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import { BEAN, PODS } from '~/constants/tokens';
import {
  MarketStatus,
  PodListingFragment,
  PodOrderFragment,
} from '~/generated/graphql';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { toTokenUnitsBN } from '~/util';

export enum PricingType {
  FIXED = 0,
  DYNAMIC = 1,
}

export type PricingTypes = PricingType | null;
export type PricingFunctions = string | null;

/**
 * Cast a Pod Listing from Subgraph form -> Redux form.
 * @param listing The PodListing as returned by the subgraph.
 * @returns Redux form of PodListing.
 */
export const castPodListing = (
  listing: PodListingFragment,
  harvestableIndex: BigNumber
): PodListing => {
  const [account, id] = listing.id.split('-'); // Subgraph returns a conjoined ID
  const index = toTokenUnitsBN(id, BEAN[1].decimals);
  const maxHarvestableIndex = toTokenUnitsBN(listing.maxHarvestableIndex, BEAN[1].decimals);

  return {
    // Identifiers
    id: id,
    account: listing.farmer.id || account,
    
    // Configuration
    index: index,
    start: toTokenUnitsBN(listing.start, BEAN[1].decimals),
    mode: listing.mode.toString() as FarmToMode, // FIXME: use numbers instead?
    
    // Constraints
    maxHarvestableIndex: maxHarvestableIndex,
    minFillAmount: toTokenUnitsBN(listing.minFillAmount || ZERO_BN, BEAN[1].decimals), // default to zero for backwards compat
    
    // Pricing
    pricingType: (listing?.pricingType as PricingType) || null,
    pricePerPod: toTokenUnitsBN(listing.pricePerPod, BEAN[1].decimals), // if pricingTyped == null | 0
    pricingFunction: listing?.pricingFunction ?? null, // if pricingType == 1
    
    // Amounts [Relative to Original]
    originalIndex: toTokenUnitsBN(listing.originalIndex, BEAN[1].decimals),
    originalAmount: toTokenUnitsBN(listing.originalAmount, BEAN[1].decimals),
    filled: toTokenUnitsBN(listing.filled, BEAN[1].decimals),
    
    // Amounts [Relative to Child]
    amount: toTokenUnitsBN(listing.amount, BEAN[1].decimals),
    remainingAmount: toTokenUnitsBN(listing.remainingAmount, BEAN[1].decimals),
    filledAmount: toTokenUnitsBN(listing.filledAmount, BEAN[1].decimals),
    
    // Computed
    placeInLine: index.minus(harvestableIndex),
    expiry: maxHarvestableIndex.minus(harvestableIndex),

    // Metadata
    status: listing.status as MarketStatus,
    createdAt: listing?.createdAt || null,
    creationHash: listing.creationHash,
  };
};

/**
 * Cast a Pod Order from Subgraph form -> Redux form.
 * @param order The PodOrder as returned by the subgraph.
 * @returns Redux form of PodOrder.
 */
export const castPodOrder = (order: PodOrderFragment): PodOrder => {
  const podAmount = toTokenUnitsBN(order.podAmount, BEAN[1].decimals);
  const beanAmount = toTokenUnitsBN(order.beanAmount, BEAN[1].decimals);
  const podAmountFilled = toTokenUnitsBN(order.podAmountFilled, BEAN[1].decimals);
  const beanAmountFilled = toTokenUnitsBN(order.beanAmountFilled, BEAN[1].decimals);

  return {
    // Identifiers
    id: order.id,
    account: order.farmer.id,

    // Pricing
    pricingType: (order.pricingType as PricingType) || null,
    pricePerPod: toTokenUnitsBN(order.pricePerPod, BEAN[1].decimals),  // if pricingTyped == null | 0
    pricingFunction: order?.pricingFunction ?? null, // if pricingType == 1

    // Constraints
    maxPlaceInLine: toTokenUnitsBN(order.maxPlaceInLine, BEAN[1].decimals),
    minFillAmount: toTokenUnitsBN(order.minFillAmount || ZERO_BN, PODS.decimals), // default to zero for backwards compat

    // Amounts
    podAmount: podAmount,
    podAmountFilled: podAmountFilled,
    beanAmount: beanAmount,
    beanAmountFilled: beanAmountFilled,

    // Computed
    podAmountRemaining: podAmount.minus(podAmountFilled),
    beanAmountRemaining: beanAmount.minus(beanAmountFilled),

    // Metadata
    status: order.status as MarketStatus,
    createdAt: order.createdAt,
    creationHash: order.creationHash,
  };
};

/**
 * Unless otherwise specified, values here match the value returned by the subgraph
 * in BigNumber form with the appropriate number of decimals.
 * 
 * See Beanstalk-Subgraph/schema.graphql for details.
 */
export type PodListing = {
  /// ///////////// Identifiers ////////////////

  id: string;
  account: string;

  /// ///////////// Configuration ////////////////

  index: BigNumber;
  start: BigNumber;
  mode: FarmToMode;

  /// ///////////// Constraints ////////////////

  maxHarvestableIndex: BigNumber;
  minFillAmount: BigNumber;

  /// ///////////// Pricing ////////////////

  pricingType: PricingTypes;
  pricePerPod: BigNumber; // Beans per Pod
  pricingFunction: PricingFunctions;

  /// ///////////// Amounts [Relative to Original] ////////////////

  originalIndex: BigNumber;
  originalAmount: BigNumber;
  filled: BigNumber;

  /// ///////////// Amounts [Relative to Child] ////////////////

  amount: BigNumber;
  remainingAmount: BigNumber;
  filledAmount: BigNumber;

  /// ///////////// Computed ////////////////

  placeInLine: BigNumber;
  expiry: BigNumber;

  /// ///////////// Metadata ////////////////

  status: MarketStatus;
  createdAt: string;
  creationHash: string;
};

/**
 * Unless otherwise specified, values here match the value returned by the subgraph
 * in BigNumber form with the appropriate number of decimals.
 * 
 * See Beanstalk-Subgraph/schema.graphql for details.
 */
export type PodOrder = {
  /// ///////////// Identifiers ////////////////

  id: string;
  account: string;

  /// ///////////// Constraints ////////////////

  maxPlaceInLine: BigNumber;
  minFillAmount: BigNumber;

  /// ///////////// Pricing ////////////////

  pricingType: PricingTypes;
  pricePerPod: BigNumber; // Beans per Pod
  pricingFunction: PricingFunctions;

  /// ///////////// Amounts ////////////////

  podAmount: BigNumber;
  podAmountFilled: BigNumber;
  beanAmount: BigNumber;
  beanAmountFilled: BigNumber;
  
  /// ///////////// Computed ////////////////

  podAmountRemaining: BigNumber;
  beanAmountRemaining: BigNumber;

  /// ///////////// Metadata ////////////////

  status: MarketStatus;
  createdAt: string;
  creationHash: string;
};

export type FarmerMarket = {
  listings: {
    [plotIndex: string]: PodListing;
  };
  orders: {
    [id: string]: PodOrder;
  };
};
