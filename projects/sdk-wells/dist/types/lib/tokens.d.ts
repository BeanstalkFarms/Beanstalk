import { Token, ERC20Token, NativeToken } from "@beanstalk/sdk-core";
import { WellsSDK } from "./WellsSDK";
export declare type TokenSTokensymbol = {
    [symbol: string]: Token;
};
export declare class Tokens {
    private static sdk;
    private tokens;
    ETH: NativeToken;
    WETH: ERC20Token;
    BEAN: ERC20Token;
    USDC: ERC20Token;
    constructor(sdk: WellsSDK);
    /**
     * Find a token by address
     */
    findByAddress(address: string): Token | undefined;
    /**
     * Find a Token by symbol
     */
    findBySymbol(symbol: string): Token | undefined;
}
