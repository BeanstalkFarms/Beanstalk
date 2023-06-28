import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Blocks } from "src/constants/blocks";
import { ChainId } from "src/constants";
import flattenDeep from "lodash.flattendeep";
import { ethers } from "ethers";
import { Token } from "src/classes/Token";

/**
 * Extracts the argument types from a function
 */
type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

/**
 * Creates a mapping of event group => array of arguments
 */
type QueryFilterArgs = {
  silo: ArgumentTypes<EventManager["getSiloEvents"]>;
  field: ArgumentTypes<EventManager["getFieldEvents"]>;
};

/**
 * Base options for all event queries
 */
type QueryFilterOptions = {
  fromBlock?: string | number;
  toBlock?: string | number;
};

/**
 * Simplify an ethers.Event object
 */

export namespace EventManager {
  export type Simplify<T extends ethers.Event> = Pick<
    T,
    "event" | "args" | "blockNumber" | "transactionIndex" | "transactionHash" | "logIndex"
  > & { returnValues?: any };

  /**
   * Each event "group" queries multiple filters
   */
  export type Group = "silo" | "field";

  /**
   * The EventManager returns a simplified version of ethers' event
   */
  export type Event = Simplify<ethers.Event>;
}

export class EventManager {
  private readonly sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    this.sdk = sdk;
  }

  async getSiloEvents(account: string, opts: QueryFilterOptions & { token?: Token } = {}) {
    if (!account) throw new Error("EventManager: getSiloEvents requires an account");

    // TODO: set this to SiloV3 deployment block
    const fromBlock = opts.fromBlock ?? Blocks[ChainId.MAINNET].BEANSTALK_GENESIS_BLOCK;
    const toBlock = opts.toBlock ?? "latest";

    return Promise.all([
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.AddDeposit(account, opts.token?.address),
        fromBlock,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveDeposit(account, opts.token?.address),
        fromBlock,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveDeposits(account, opts.token?.address),
        fromBlock,
        toBlock
      )
    ]);
  }

  async getFieldEvents(account: string, opts: QueryFilterOptions = {}) {
    if (!account) throw new Error("EventManager: getSiloEvents requires an account");

    const fromBlock = opts.fromBlock ?? Blocks[ChainId.MAINNET].BEANSTALK_GENESIS_BLOCK;
    const toBlock = opts.toBlock ?? "latest";

    return Promise.all([
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters["Sow(address,uint256,uint256,uint256)"](account),
        fromBlock,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(this.sdk.contracts.beanstalk.filters.Harvest(account), fromBlock, toBlock),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.PlotTransfer(account, null), // from
        fromBlock,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.PlotTransfer(null, account), // to
        fromBlock,
        toBlock
      )
    ]);
  }

  private simplifyAndSort(events: ethers.Event[][]) {
    return flattenDeep<ethers.Event[]>(events) // flatten across event hashes
      .reduce(simplifyEvent, []) // only grab what we need to save memory
      .sort(sortEvents); // sort by blockNumber, then logIndex
  }

  /**
   * Loads the raw event data for "silo" or "field" events, then simplifies
   * and sorts by the order they occurred on chain.
   */
  public get<T extends EventManager.Group>(type: T, args: QueryFilterArgs[T]): Promise<EventManager.Event[]> {
    const [account, opts] = args;
    switch (type) {
      case "silo": {
        return this.getSiloEvents(account, opts).then(this.simplifyAndSort);
      }
      case "field": {
        return this.getFieldEvents(account, opts).then(this.simplifyAndSort);
      }
      default: {
        throw new Error(`EventManager: Unknown event type ${type}`);
      }
    }
  }
}

/**
 * To reduce memory, we only keep a few fields from the ethers Event object.
 */
export const simplifyEvent = (prev: EventManager.Event[], e: ethers.Event) => {
  try {
    prev.push({
      event: e.event,
      args: e.args,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      transactionHash: e.transactionHash,
      transactionIndex: e.transactionIndex
    });
  } catch (err) {
    console.error(`Failed to parse event ${e.event} ${e.transactionHash}`, err, e);
  }
  return prev;
};

/**
 * This sorts by the order the events occurred on chain, oldest first.
 * If two events are emitted in the same block, the logIndex is used to
 * ensure proper ordering.
 */
export const sortEvents = (a: EventManager.Event, b: EventManager.Event) => {
  const diff = a.blockNumber - b.blockNumber;
  if (diff !== 0) return diff;
  return a.logIndex - b.logIndex;
};
