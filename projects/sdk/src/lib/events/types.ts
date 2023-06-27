import { BigNumber } from "ethers";
import { FarmToMode } from "src/lib/farm/types";

// FIXME - this normally comes from generated/graphql
//    tho there is a comment in UI to make it an enum. need to verify
//    this is ok
export enum MarketStatus {
  Active = "ACTIVE",
  Cancelled = "CANCELLED",
  CancelledPartial = "CANCELLED_PARTIAL",
  Expired = "EXPIRED",
  Filled = "FILLED",
  FilledPartial = "FILLED_PARTIAL"
}

export type FarmerMarket = {
  listings: {
    [plotIndex: string]: PodListing;
  };
  orders: {
    [id: string]: PodOrder;
  };
};
