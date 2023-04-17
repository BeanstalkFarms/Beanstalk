import { GraphQLClient } from "graphql-request";
import { ethers } from "ethers";
import { enumFromValue } from "src/utils";
import { addresses, ChainId } from "src/constants";
import { Tokens } from "./tokens";
import { Contracts } from "./contracts";
import { EventManager } from "./events/EventManager";
import { Silo } from "./silo";
import { Sun } from "./sun";
import { Farm } from "./farm/farm";
import { Permit } from "./permit";
import { Root } from "./root";
import { Sdk as Queries, getSdk as getQueries } from "../constants/generated-gql/graphql";
import { Swap } from "src/lib/swap/Swap";
import { TokenValue } from "src/classes/TokenValue";
import { Bean } from "./bean";
import { Pools } from "./pools";
import defaultSettings from "src/defaultSettings.json";

export type Provider = ethers.providers.JsonRpcProvider;
export type Signer = ethers.Signer;
export type BeanstalkConfig = Partial<{
  provider: Provider;
  signer: Signer;
  rpcUrl: string;
  subgraphUrl: string;
  source: DataSource;
  DEBUG: boolean;
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
  public providerOrSigner: Signer | Provider;
  public source: DataSource;
  public subgraphUrl: string;

  public readonly chainId: ChainId;

  public readonly addresses: typeof addresses;
  public readonly contracts: Contracts;
  public readonly tokens: Tokens;
  public readonly pools: Pools;
  public readonly graphql: GraphQLClient;
  public readonly queries: Queries;

  public readonly farm: Farm;
  public readonly silo: Silo;
  public readonly events: EventManager;
  public readonly sun: Sun;
  public readonly permit: Permit;
  public readonly root: Root;
  public readonly swap: Swap;
  public readonly bean: Bean;

  constructor(config?: BeanstalkConfig) {
    this.handleConfig(config);

    this.chainId = enumFromValue(this.provider?.network?.chainId ?? 1, ChainId);
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

    // Internal
    this.events = new EventManager(this);
    this.permit = new Permit(this);

    // Facets
    this.silo = new Silo(this);
    this.sun = new Sun(this);
    this.farm = new Farm(this);

    // Ecosystem
    this.root = new Root(this);
    this.swap = new Swap(this);
  }

  debug(...args: any[]) {
    if (!this.DEBUG) return;
    console.debug(...args);
  }

  ////// Configuration //////

  handleConfig(config: BeanstalkConfig = {}) {
    if (config.rpcUrl) {
      config.provider = this.getProviderFromUrl(config.rpcUrl);
    }

    this.signer = config.signer;
    if (!config.provider && !config.signer) {
      console.log("WARNING: No provider or signer specified, using DefaultProvider.");
      this.provider = ethers.getDefaultProvider() as Provider;
    } else {
      this.provider = (config.signer?.provider as Provider) ?? config.provider!;
    }
    this.providerOrSigner = config.signer ?? config.provider!;

    this.DEBUG = config.DEBUG ?? false;

    this.source = DataSource.LEDGER; // FIXME

    this.subgraphUrl = config.subgraphUrl || defaultSettings.subgraphUrl;
  }

  deriveSource<T extends { source?: DataSource }>(config?: T): DataSource {
    return config?.source || this.source;
  }

  deriveConfig<T extends BeanstalkConfig>(key: keyof Reconfigurable, _config?: T): BeanstalkConfig[typeof key] {
    return _config?.[key] || this[key];
  }

  ////// Private

  private getProviderFromUrl(url: string): Provider {
    if (url.startsWith("ws")) {
      return new ethers.providers.WebSocketProvider(url);
    }
    if (url.startsWith("http")) {
      return new ethers.providers.JsonRpcProvider(url);
    }

    throw new Error("Invalid rpcUrl");
  }

  async getAccount(_account?: string): Promise<string> {
    if (_account) return _account.toLowerCase();
    if (!this.signer) throw new Error("Cannot get account without a signer");
    const account = await this.signer.getAddress();
    if (!account) throw new Error("Failed to get account from signer");
    return account.toLowerCase();
  }
}
