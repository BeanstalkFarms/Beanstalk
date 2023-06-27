import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { EventType, reduceEvent, sortEvents } from "./utils";
import { Blocks } from "src/constants/blocks";
import { ChainId } from "src/constants";
import flattenDeep from "lodash.flattendeep";
import { Event } from "ethers";

export class EventManager {
  private readonly sdk: BeanstalkSDK;

  private readonly filters: {
    [key in EventType]: Function[];
  };

  constructor(sdk: BeanstalkSDK) {
    this.sdk = sdk;
  }

  async getSiloEvents(_account: string, _token?: string, _fromBlock?: number, _toBlock?: number) {
    const fromBlockOrGenesis = _fromBlock || Blocks[ChainId.MAINNET].BEANSTALK_GENESIS_BLOCK;
    const toBlock = _toBlock || "latest";
    return Promise.all([
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.AddDeposit(_account, _token),
        fromBlockOrGenesis,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveWithdrawal(_account, _token),
        fromBlockOrGenesis,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveWithdrawals(_account, _token),
        fromBlockOrGenesis,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveDeposit(_account, _token),
        fromBlockOrGenesis,
        toBlock
      ),
      this.sdk.contracts.beanstalk.queryFilter(
        this.sdk.contracts.beanstalk.filters.RemoveDeposits(_account, _token),
        fromBlockOrGenesis,
        toBlock
      )
    ]).then(this.reduceAndSort);
  }

  async getFieldEvents(_account: string, _fromBlock?: number, _toBlock?: number) {
    if (!_account) throw new Error("account missing");
    const rawEvents = await this.getRawEventsByType(EventType.FIELD, _account, _fromBlock, _toBlock);
    return this.reduceAndSort(rawEvents);
  }

  async getMarketEvents(_account: string, _fromBlock?: number, _toBlock?: number) {
    if (!_account) throw new Error("account missing");
    const rawEvents = await this.getRawEventsByType(EventType.MARKET, _account, _fromBlock, _toBlock);
    return this.reduceAndSort(rawEvents);
  }

  async getFertilizerEvents(_account: string, _fromBlock?: number, _toBlock?: number) {
    if (!_account) throw new Error("account missing");
    const rawEvents = await this.getRawEventsByType(EventType.FERTILIER, _account, _fromBlock, _toBlock);
    return this.reduceAndSort(rawEvents);
  }

  async getRawEventsByType(eventType: EventType, _account: string, _fromBlock?: number, _toBlock?: number): Promise<Event[][]> {
    const fromBlockOrGenesis = _fromBlock || Blocks[ChainId.MAINNET].BEANSTALK_GENESIS_BLOCK;
    const fromBlockOrBIP10 = _fromBlock || Blocks[ChainId.MAINNET].BIP10_COMMITTED_BLOCK;
    const fromBlockOrFertLaunch = _fromBlock || Blocks[ChainId.MAINNET].FERTILIZER_LAUNCH_BLOCK;
    const toBlock = _toBlock || "latest";

    switch (eventType) {
      case EventType.SILO:
        return Promise.all([
          this.sdk.contracts.beanstalk.queryFilter(this.sdk.contracts.beanstalk.filters.AddDeposit(_account), fromBlockOrGenesis, toBlock),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.RemoveWithdrawal(_account),
            fromBlockOrGenesis,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.RemoveWithdrawals(_account),
            fromBlockOrGenesis,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.RemoveDeposit(_account),
            fromBlockOrGenesis,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.RemoveDeposits(_account),
            fromBlockOrGenesis,
            toBlock
          )
        ]);
      case EventType.FIELD:
        return Promise.all([
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters["Sow(address,uint256,uint256,uint256)"](_account),
            fromBlockOrGenesis,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(this.sdk.contracts.beanstalk.filters.Harvest(_account), fromBlockOrGenesis, toBlock),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PlotTransfer(_account, null), // from
            fromBlockOrGenesis,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PlotTransfer(null, _account), // to
            fromBlockOrGenesis,
            toBlock
          )
        ]);
      case EventType.MARKET:
        return Promise.all([
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PodListingCreated(_account),
            fromBlockOrBIP10,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters["PodListingCancelled(address,uint256)"](_account),
            fromBlockOrBIP10,
            toBlock
          ),
          // this account had a listing filled
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PodListingFilled(null, _account), // to
            fromBlockOrBIP10,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PodOrderCreated(_account),
            fromBlockOrBIP10,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PodOrderCancelled(_account),
            fromBlockOrBIP10,
            toBlock
          ),
          this.sdk.contracts.beanstalk.queryFilter(
            this.sdk.contracts.beanstalk.filters.PodOrderFilled(null, _account), // to
            fromBlockOrBIP10,
            toBlock
          )
        ]);

      case EventType.FERTILIER:
        return Promise.all([
          /// Send FERT
          this.sdk.contracts.fertilizer.queryFilter(
            this.sdk.contracts.fertilizer.filters.TransferSingle(
              null, // operator
              _account, // from
              null, // to
              null, // id
              null // value
            ),
            fromBlockOrFertLaunch,
            toBlock
          ),
          this.sdk.contracts.fertilizer.queryFilter(
            this.sdk.contracts.fertilizer.filters.TransferBatch(
              null, // operator
              _account, // from
              null, // to
              null, // ids
              null // values
            ),
            fromBlockOrFertLaunch,
            toBlock
          ),
          /// Receive FERT
          this.sdk.contracts.fertilizer.queryFilter(
            this.sdk.contracts.fertilizer.filters.TransferSingle(
              null, // operator
              null, // from
              _account, // to
              null, // id
              null // value
            ),
            fromBlockOrFertLaunch,
            toBlock
          ),
          this.sdk.contracts.fertilizer.queryFilter(
            this.sdk.contracts.fertilizer.filters.TransferBatch(
              null, // operator
              null, // from
              _account, // to
              null, // ids
              null // values
            ),
            fromBlockOrFertLaunch,
            toBlock
          )
        ]);

      default:
        throw new Error(`Cannot build event EventQuery for unknown type: ${eventType}`);
    }
  }

  // : TypedEvent[]
  private reduceAndSort(events: Event[][]) {
    return flattenDeep<Event[]>(events).reduce(reduceEvent, []).sort(sortEvents);
  }
}
