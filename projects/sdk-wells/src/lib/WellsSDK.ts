import { ChainId } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { addresses } from "src/constants/addresses";
import { enumFromValue } from "src/utils";
import { Router } from "./routing";
import { SwapBuilder } from "./swap/SwapBuilder";
import { Tokens } from "./tokens";
import { PreloadOptions, Well } from "./Well";

export type Provider = ethers.providers.JsonRpcProvider;
export type Signer = ethers.Signer;
export type SDKConfig = Partial<{
  provider: Provider;
  signer: Signer;
  rpcUrl: string;
  DEBUG: boolean;
}>;

export class WellsSDK {
  public DEBUG: boolean;
  public signer?: Signer;
  public provider: Provider;
  public providerOrSigner: Signer | Provider;
  public Router = Router;

  public readonly chainId: ChainId;

  public readonly addresses: typeof addresses;
  public readonly tokens: Tokens;
  public readonly swapBuilder: SwapBuilder;

  constructor(config?: SDKConfig) {
    this.handleConfig(config);

    this.chainId = enumFromValue(this.provider?.network?.chainId ?? 1, ChainId);

    // Globals
    this.addresses = addresses;
    this.tokens = new Tokens(this);

    this.swapBuilder = new SwapBuilder(this);
  }

  /**
   * Get a Well object from a well address.
   *
   * By default, this also pre-loads well details from the chain. What data
   * is preloaded, or to avoid preloading, can be controlled via the preloadOptions
   * object.
   *
   * @param address - address where well is deployed
   * @param preloadOptions - What data to pre fetch. If undefined, all data will be
   * prefetched, otherwise only the properties defined as true will be retrieved
   *
   *
   * @returns Well object
   */
  async getWell(address: string, preloadOptions?: PreloadOptions): Promise<Well> {
    const well = new Well(this, address);
    await well.loadWell(preloadOptions);

    return well;
  }

   debug(...args: any[]) {
    if (!this.DEBUG) return;
    console.debug(...args);
  }

  handleConfig(config: SDKConfig = {}) {
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
  }

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
