import { BigNumber } from "ethers";
import { DecimalBigNumber } from "../lib/DecimalBigNumber";
declare const blocker: {};
export declare class TokenValue {
    static ZERO: TokenValue;
    static NEGATIVE_ONE: TokenValue;
    static ONE: TokenValue;
    static MAX_UINT32: TokenValue;
    static MAX_UINT256: TokenValue;
    humanString: string;
    blockchainString: string;
    decimals: number;
    value: DecimalBigNumber;
    /**
     * Create a TokenValue from string, number, or BigNumber values that represent a **human** readable form.
     * For example: "3" ETH, or "4.5" beans.
     * If your value is a blockchain value, for ex 3e18 or 4500000, use `fromBlockchain()` method instead.
     *
     * Example: `fromHuman('3.14', 6)` means 3.14 BEAN tokens, and would be represented as 3140000 on the blockchain
     *
     * Warning: Even thought we support supplying the value as a BigNumber, make sure you really mean to use it here.
     * If your input is a BigNumber, you most likely want to use `.fromBlockchain()`
     *
     * @param value The amount, as a human readable value, in string, number or BigNumber form.
     * @param decimals The number of decimals this TokenValue should be stored with. For ex, 6 for BEAN or 18 for ETH
     * @returns a TokenValue
     */
    static fromHuman(value: string | number | BigNumber, decimals: number): TokenValue;
    /**
     * Create a TokenValue from string, number, or BigNumber values that represent a **blockhain** value.
     * For example: 3e18 ETH, or 4500000 beans.
     * If your value is a human readable value, for ex 5 ETH  or 3.14 BEAN, use `fromHuman()` method instead.
     *
     * Example: `fromBlockchain('3140000', 6)` means 3.14 BEAN tokens, and would be represented as 3140000 on the blockchain
     * @param value The amount, as a human readable value, in string, number or BigNumber form.
     * @param decimals The number of decimals this TokenValue should be stored with. For ex, 6 for BEAN or 18 for ETH
     * @returns a TokenValue
     */
    static fromBlockchain(value: string | number | BigNumber, decimals: number): TokenValue;
    /**
     * Create a TokenValue from another decimal-supporting object: DecimalBigNumber or TokenValue.
     *
     * @param value The amount
     * @returns a TokenValue
     */
    static from(value: DecimalBigNumber | TokenValue): TokenValue;
    private static fromBigNumber;
    private static fromString;
    constructor(_blocker: typeof blocker, _bigNumber: BigNumber, decimals: number);
    toBigNumber(): BigNumber;
    toBlockchain(): string;
    /**
     * @deprecated
     * Ambiguous function. This exists only as a safety, otherwise the .toString()
     * call would go to Object.toString().
     * @returns
     */
    toString(): string;
    toHex(): string;
    /**
     * Returns a human readable string, for example "3.14"
     * @returns string
     */
    toHuman(): string;
    private toDBN;
    /**
     * Returns a new TokenValue with the number of decimals set to the new value
     * @param decimals
     */
    reDecimal(decimals: number): TokenValue;
    add(num: TokenValue | BigNumber | number): TokenValue;
    sub(num: TokenValue | BigNumber | number): TokenValue;
    mod(num: TokenValue | number): TokenValue;
    mul(num: TokenValue | number): TokenValue;
    mulMod(num: TokenValue | number, denominator: TokenValue | number): TokenValue;
    mulDiv(num: TokenValue | BigNumber | number, denominator: TokenValue | number, rounding?: "down" | "up"): TokenValue;
    div(num: TokenValue | BigNumber | number, decimals?: number): TokenValue;
    eq(num: TokenValue | BigNumber | number): boolean;
    gt(num: TokenValue | BigNumber | number): boolean;
    gte(num: TokenValue | BigNumber | number): boolean;
    lt(num: TokenValue | BigNumber | number): boolean;
    lte(num: TokenValue | BigNumber | number): boolean;
    static min(...values: TokenValue[]): TokenValue;
    static max(...values: TokenValue[]): TokenValue;
    abs(): TokenValue;
    pow(num: number): TokenValue;
    pct(num: number): TokenValue;
    /**
     * Calculates value after substracting slippage.
     *
     * For ex, a value of 100, with slippage 3 would return 97
     *
     * @param slippage The percent to remove from the value. Slippage should be
     * a human readable percentage; 3 = 3%, 25=25%, .1 = 0.1%
     *
     * @return The original value minus slippage
     */
    subSlippage(slippage: number): TokenValue;
    /**
     * Calculates value after adding slippage.
     *
     * For ex, a value of 100, with slippage 3 would return 103
     *
     * @param slippage The percent to remove from the value. Slippage should be
     * a human readable percentage; 3 = 3%, 25=25%, .1 = 0.1%
     *
     * @return The original value plus slippage
     */
    addSlippage(slippage: number): TokenValue;
}
export {};
