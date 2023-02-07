import { ChainId } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { addresses } from "../constants/addresses";
import { Tokens } from "./tokens";
import { PreloadOptions, Well } from "./Well";
export declare type Provider = ethers.providers.JsonRpcProvider;
export declare type Signer = ethers.Signer;
export declare type SDKConfig = Partial<{
    provider: Provider;
    signer: Signer;
    rpcUrl: string;
    DEBUG: boolean;
}>;
export declare class WellsSDK {
    DEBUG: boolean;
    signer?: Signer;
    provider: Provider;
    providerOrSigner: Signer | Provider;
    readonly chainId: ChainId;
    readonly addresses: typeof addresses;
    readonly tokens: Tokens;
    constructor(config?: SDKConfig);
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
    getWell(address: string, preloadOptions?: PreloadOptions): Promise<Well>;
    debug(...args: any[]): void;
    handleConfig(config?: SDKConfig): void;
    private getProviderFromUrl;
    getAccount(_account?: string): Promise<string>;
}
