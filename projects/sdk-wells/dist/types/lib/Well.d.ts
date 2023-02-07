import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { CallOverrides, ContractTransaction, Overrides } from "ethers";
import { Well as WellContract } from "../constants/generated";
import { Auger } from "./Auger";
import { Pump } from "./Pump";
import { WellFunction } from "./WellFunction";
import { WellsSDK } from "./WellsSDK";
export declare type WellDetails = {
    tokens: ERC20Token[];
    wellFunction: WellFunction;
    pumps: Pump[];
    auger: Auger;
};
export declare type CallStruct = {
    target: string;
    data: string;
};
export declare type TxOverrides = Overrides & {
    from?: string;
};
export declare type PreloadOptions = {
    name?: boolean;
    lpToken?: boolean;
    tokens?: boolean;
    wellFunction?: boolean;
    pumps?: boolean;
    auger?: boolean;
    reserves?: boolean;
};
export declare class Well {
    sdk: WellsSDK;
    address: string;
    contract: WellContract;
    name: string | undefined;
    lpToken: ERC20Token | undefined;
    tokens: ERC20Token[] | undefined;
    wellFunction: WellFunction | undefined;
    pumps: Pump[] | undefined;
    auger: Auger | undefined;
    reserves: TokenValue[] | undefined;
    constructor(sdk: WellsSDK, address: string);
    /**
     * Loads Well data from chain
     *
     * If no options are specified, it will load everything. However, if
     * an options object is passed, it will only load those the data
     * whose options is set to true.
     *
     * loadWell() -- loads everything
     * loadWell({tokens: true}) - only loads tokens
     *
     */
    loadWell(options?: PreloadOptions): Promise<void>;
    /**
     * Get this Well's name
     */
    getName(): Promise<string>;
    /**
     * Get this Well's LP Token
     */
    getLPToken(): Promise<ERC20Token>;
    /**
     * Get the tradeable tokens paired in this Well
     */
    getTokens(): Promise<ERC20Token[]>;
    /**
     * Returns the Well function of this well.
     * **Well functions** define a relationship between the reserves of the
     * tokens in the Well and the number of LP tokens.
     *
     */
    getWellFunction(): Promise<WellFunction>;
    /**
     * Returns the Pumps attached to the Well.
     */
    getPumps(): Promise<Pump[]>;
    /**
     * Returns the Auger that bored this Well.
     * The Auger is a Well factory; it creates Wells based on "templates".
     */
    getAuger(): Promise<Auger>;
    /**
     * Returns the tokens, Well function, and Pump associated with this Well.
     *
     * This is an aggregate of calling these individual methods:
     * getTokens(), getWellFunction(), getPumps(), getAuger()
     *
     * Since this is one contract call, the other individual methods also
     * call this under the hood, getting other data cached for "free"
     */
    getWell(): Promise<WellDetails>;
    private setTokens;
    private setWellFunction;
    private setPumps;
    private setAuger;
    /**
     * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountIn The amount of `fromToken` to spend
     * @param minAmountOut The minimum amount of `toToken` to receive
     * @param recipient The address to receive `toToken`
     * @return amountOut The amount of `toToken` received
     */
    swapFrom(fromToken: Token, toToken: Token, amountIn: TokenValue, minAmountOut: TokenValue, recipient: string, overrides?: Overrides): Promise<ContractTransaction>;
    /**
     * Gets the amount of `toToken` received for swapping an amount of `fromToken`.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountIn The amount of `fromToken` to spend
     * @return amountOut The amount of `toToken` to receive
     */
    swapFromQuote(fromToken: Token, toToken: Token, amountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue>;
    /**
     * Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param maxAmountIn The maximum amount of `fromToken` to spend
     * @param amountOut The amount of `toToken` to receive
     * @param recipient The address to receive `toToken`
     * @return amountIn The amount of `toToken` received
     */
    swapTo(fromToken: Token, toToken: Token, maxAmountIn: TokenValue, amountOut: TokenValue, recipient: string, overrides?: TxOverrides): Promise<ContractTransaction>;
    /**
     * Gets the amount of `fromToken` needed in order to receive a specific amount of `toToken`
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountOut The amount of `toToken` desired
     * @return amountIn The amount of `fromToken` that must be spent
     */
    swapToQuote(fromToken: Token, toToken: Token, amountOut: TokenValue, overrides?: CallOverrides): Promise<TokenValue>;
    /**
     * Adds liquidity to the Well as multiple tokens in any ratio.
     * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
     * @param minLpAmountOut The minimum amount of LP tokens to receive
     * @param recipient The address to receive the LP tokens
     */
    addLiquidity(tokenAmountsIn: TokenValue[], minLpAmountOut: TokenValue, recipient: string, overrides?: TxOverrides): Promise<ContractTransaction>;
    /**
     * Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
     * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
     * @return lpAmountOut The amount of LP tokens to receive
     */
    addLiquidityQuote(tokenAmountsIn: TokenValue[], overrides?: CallOverrides): Promise<TokenValue>;
    /**
     * Removes liquidity from the Well as all underlying tokens in a balanced ratio.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @param recipient The address to receive the underlying tokens
     * @return tokenAmountsOut The amount of each underlying token received
     */
    removeLiquidity(lpAmountIn: TokenValue, minTokenAmountsOut: TokenValue[], recipient: string, overrides?: CallOverrides): Promise<ContractTransaction>;
    /**
     * Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
     * @param lpAmountIn The amount of LP tokens to burn
     * @return tokenAmountsOut The amount of each underlying token to receive
     */
    removeLiquidityQuote(lpAmountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue[]>;
    /**
     * Removes liquidity from the Well as a single underlying token.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param tokenOut The underlying token to receive
     * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
     * @param recipient The address to receive the underlying tokens
     * @return tokenAmountOut The amount of `tokenOut` received
     */
    removeLiquidityOneToken(lpAmountIn: TokenValue, tokenOut: Token, minTokenAmountOut: TokenValue, recipient: string, overrides?: TxOverrides): Promise<ContractTransaction>;
    /**
     * Gets the amount received from removing liquidity from the Well as a single underlying token.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param tokenOut The underlying token to receive
     * @return tokenAmountOut The amount of `tokenOut` to receive
     *
     */
    removeLiquidityOneTokenQuote(lpAmountIn: TokenValue, tokenOut: Token, overrides?: CallOverrides): Promise<TokenValue>;
    /**
     * Removes liquidity from the Well as multiple underlying tokens in any ratio.
     * @param maxLpAmountIn The maximum amount of LP tokens to burn
     * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @param recipient The address to receive the underlying tokens
     * @return lpAmountIn The amount of LP tokens burned
     */
    removeLiquidityImbalanced(maxLpAmountIn: TokenValue, tokenAmountsOut: TokenValue[], recipient: string, overrides?: TxOverrides): Promise<ContractTransaction>;
    /**
     * Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
     * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @return lpAmountIn The amount of LP tokens to burn
     */
    removeLiquidityImbalancedQuote(tokenAmounts: TokenValue[], overrides?: CallOverrides): Promise<TokenValue>;
    /**
     * Gets the reserves of each token held by the Well.
     */
    getReserves(overrides?: CallOverrides): Promise<TokenValue[]>;
    /**
     * Sends excess ERC-20 tokens held by the Well to the `recipient`.
     * @param recipient The address to send the tokens
     * @return skimAmounts The amount of each token skimmed
     */
    skim(address: string, overrides?: TxOverrides): Promise<ContractTransaction>;
}
