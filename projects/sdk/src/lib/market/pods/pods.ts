import { ethers } from "ethers";
import { BeanstalkSDK, DataSource } from "src/lib/BeanstalkSDK";

class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends BaseError {
  constructor(entity?: string, id?: string) {
    const message = `${entity ? `${entity} not found` : `Not found`}${id ? `: ${id}` : ""}`;
    super(message);
  }
}

export class PodsMarket {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    PodsMarket.sdk = sdk;
  }

  /**
   * Get a listing by ID.
   *
   * @param id
   * @param options
   */
  public async getListing(
    id: string,
    options?: {
      source: DataSource.SUBGRAPH;
      validate: boolean;
    }
  ) {
    const [isValid, query] = await Promise.all([
      options?.validate
        ? PodsMarket.sdk.contracts.beanstalk.podListing(id).then((r) => ethers.BigNumber.from(r).gt(0))
        : Promise.resolve(true),
      PodsMarket.sdk.queries.getListingByIndex({ index: id })
    ]);

    if (!isValid || !query.podListings[0]) {
      throw new NotFoundError("Listing", id);
    }

    return query.podListings[0]; // FIXME: cast
  }

  /**
   * TODO:
   *
   * Casting into final form
   * MarketStatus enum
   *
   * getOrder
   *
   * getListings
   * getOrders
   */
}
