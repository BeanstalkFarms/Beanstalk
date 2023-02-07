import { ethers } from "ethers";
import { addresses, ChainId } from "src/constants";
import { enumFromValue } from "src/utils";
import { Contracts } from "./contracts";
import { Tokens } from "./tokens";

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

  public readonly chainId: ChainId;

  public readonly addresses: typeof addresses;
  public readonly contracts: Contracts;
  public readonly tokens: Tokens;

  constructor(config?: SDKConfig) {
    this.handleConfig(config);

    this.chainId = enumFromValue(this.provider?.network?.chainId ?? 1, ChainId);

    // Globals
    this.addresses = addresses;
    this.contracts = new Contracts(this);
    this.tokens = new Tokens(this);
  }

  debug(...args: any[]) {
    if (!this.DEBUG) return;
    console.debug(...args);
  }

  ////// Configuration //////

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
