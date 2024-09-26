import { GraphQLClient } from "graphql-request";
import { ethers } from "ethers";
import { enumFromValue } from "src/utils";
import { addresses } from "src/constants";
import { Tokens } from "./tokens";
import { Contracts } from "./contracts";
import { EventManager } from "./events/EventManager";
import { Silo } from "./silo";
import { Sun } from "./sun";
import { Farm } from "./farm/farm";
import { Permit } from "./permit";
import { Sdk as Queries, getSdk as getQueries } from "../constants/generated-gql/graphql";
import { Swap } from "src/lib/swap/Swap";
import { Bean } from "./bean";
import { Pools } from "./pools";
import defaultSettings from "src/defaultSettings.json";
import { WellsSDK } from "@beanstalk/sdk-wells";
import { ChainId, ChainResolver } from "@beanstalk/sdk-core";
import { Field } from "./field";
import { ZeroX } from "./matcha";

export type Provider = ethers.providers.JsonRpcProvider;
export type Signer = ethers.Signer;
export type BeanstalkConfig = Partial<{
  provider: Provider;
  readProvider?: Provider;
  signer: Signer;
  rpcUrl: string;
  subgraphUrl: string;
  source: DataSource;
  DEBUG: boolean;
  zeroXApiKey?: string;
}>;

type Reconfigurable = Pick<BeanstalkConfig, "source">;

// FIXME: add tests to ensure the proper DataSource is used. Setting a value to 0 causes issues rn
export enum DataSource {
  LEDGER = 1,
  SUBGRAPH = 2
}

export class BeanstalkSDK {
  public DEBUG: boolean;
  public signer?: Signer;
  public provider: Provider;
  public readProvider?: Provider;
  public providerOrSigner: Signer | Provider;
  public source: DataSource;
  public subgraphUrl: string;
  public lastRefreshTimestamp: number;

  public readonly chainId: ChainId;
  public readonly addresses: typeof addresses;
  public readonly contracts: Contracts;
  public readonly tokens: Tokens;
  public readonly pools: Pools;
  public readonly graphql: GraphQLClient;
  public readonly queries: Queries;
  public readonly zeroX: ZeroX;

  public readonly farm: Farm;
  public readonly silo: Silo;
  public readonly field: Field;
  public readonly events: EventManager;
  public readonly sun: Sun;
  public readonly permit: Permit;
  public readonly swap: Swap;
  public readonly bean: Bean;
  public readonly wells: WellsSDK;

  constructor(config?: BeanstalkConfig) {
    this.handleConfig(config);

    this.chainId = this.deriveChainId();
    this.subgraphUrl = config?.subgraphUrl || this.deriveSubgraphURL(this.chainId);
    this.source = config?.source || DataSource.SUBGRAPH;

    // Beanstalk
    this.bean = new Bean(this);

    // Globals
    this.addresses = addresses;
    this.contracts = new Contracts(this);
    this.tokens = new Tokens(this);
    this.pools = new Pools(this);
    this.graphql = new GraphQLClient(this.subgraphUrl);
    this.queries = getQueries(this.graphql);
    this.zeroX = new ZeroX(config?.zeroXApiKey);

    // // Internal
    this.events = new EventManager(this);
    this.permit = new Permit(this);

    // // Facets
    this.silo = new Silo(this);
    this.sun = new Sun(this);
    this.farm = new Farm(this);
    this.field = new Field(this);

    // // Ecosystem
    this.swap = new Swap(this);

    // // Wells
    this.wells = new WellsSDK(config);
  }

  /**
   * Refreshes the SDK's state with updated data from contracts. This should be called immediately after sdk initialization and after every season
   */
  async refresh() {
    // Reload dynamic stalk per wl token
    const whitelist = this.tokens.siloWhitelist;
    for await (const token of whitelist) {
      const { stalkEarnedPerSeason } = await this.contracts.beanstalk.tokenSettings(token.address);
      token.rewards!.seeds = this.tokens.SEEDS.fromBlockchain(stalkEarnedPerSeason);
    }
    this.lastRefreshTimestamp = Date.now();
  }

  debug(...args: any[]) {
    if (!this.DEBUG) return;
    console.debug(...args);
  }

  ////// Configuration //////

  handleConfig(config: BeanstalkConfig = {}) {
    if (config.rpcUrl) {
      config.provider = this.getProviderFromUrl(config.rpcUrl, config);
    }

    this.signer = config.signer;
    if (!config.provider && !config.signer) {
      console.log("WARNING: No provider or signer specified, using DefaultProvider.");
      this.provider = ethers.getDefaultProvider() as Provider;
    } else {
      this.provider = (config.signer?.provider as Provider) ?? config.provider!;
    }
    this.readProvider = config.readProvider;
    this.providerOrSigner = config.signer ?? config.provider!;

    this.DEBUG = config.DEBUG ?? false;

    this.source = DataSource.LEDGER; // FIXME
  }

  deriveSource<T extends { source?: DataSource }>(config?: T): DataSource {
    return config?.source || this.source;
  }

  deriveConfig<T extends BeanstalkConfig>(
    key: keyof Reconfigurable,
    _config?: T
  ): BeanstalkConfig[typeof key] {
    return _config?.[key] || this[key];
  }

  ////// Private

  private getProviderFromUrl(url: string, config: BeanstalkConfig): Provider {
    const provider = config.signer ? (config.signer.provider as Provider) : config.provider;
    const networkish = provider?._network || provider?.network || ChainResolver.defaultChainId;

    if (url.startsWith("ws")) {
      return new ethers.providers.WebSocketProvider(url, networkish);
    }
    if (url.startsWith("http")) {
      return new ethers.providers.JsonRpcProvider(url, networkish);
    }

    throw new Error("Invalid rpcUrl");
  }

  private deriveSubgraphURL(_chainId: ChainId) {
    if (ChainResolver.isL1Chain(_chainId)) {
      return defaultSettings.subgraphUrlEth;
    }
    return defaultSettings.subgraphUrl;
  }

  private deriveChainId() {
    const { _network, network } = this.provider || {};
    const providerChainId = _network?.chainId || network?.chainId || ChainResolver.defaultChainId;

    return enumFromValue(providerChainId, ChainId);
  }

  async getAccount(_account?: string): Promise<string> {
    if (_account) return _account.toLowerCase();
    if (!this.signer) throw new Error("Cannot get account without a signer");
    const account = await this.signer.getAddress();
    if (!account) throw new Error("Failed to get account from signer");
    return account.toLowerCase();
  }

  /**
   * This methods helps serialize the SDK object. When used in a react
   * dependency array, the signer and provider objects have circular references
   * which cause errors. This overrides the result and allows using the sdk
   * in dependency arrays (which use .toJSON under the hood)
   * @returns
   */
  toJSON() {
    return {
      chainId: this.chainId,
      lastRefreshTimestamp: this.lastRefreshTimestamp,
      provider: {
        url: this.provider?.connection?.url,
        network: this.provider?._network
      },
      signer: this.signer
        ? {
            provider: {
              // @ts-ignore
              network: this.signer?.provider?._network
            },
            // @ts-ignore
            address: this.signer?._address
          }
        : undefined
    };
  }
}
