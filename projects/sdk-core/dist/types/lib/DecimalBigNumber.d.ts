import { BigNumber } from "ethers";
export declare class DecimalBigNumber {
    private _decimals;
    private _value;
    /**
     * Creates a new instance of `DecimalBigNumber`.
     *
     * @description This class expects and suggests that numbers be handled using `DecimalBigNumber`, instead of the inherently inaccurate
     * use of `number` and `string` types.
     *
     * The constructor accepts the following as inputs to the number parameter:
     * - `BigNumber` (from @ethersproject/bignumber): to easily shift from `BigNumber` used in smart contracts to `DecimalBigNumber`
     * - `BigNumber` (from @beanstalk/sdk/BigNumber): a clone of @ethersproject/bignumber with some utilities used in @beanstalk/sdk
     * - `string`: to take input from the user
     *
     * Given these design decisions, there are some recommended approaches:
     * - Obtain user input with type text, instead of a number, in order to retain precision. e.g. `<input type="text" />`
     * - Where a `number` value is present, convert it to a `DecimalBigNumber` in the manner the developer deems appropriate.
     *   This will most commonly be `new DecimalBigNumber((1000222000.2222).toString(), 4)`. While a convenience method could be offered,
     *   it could lead to unexpected behaviour around precision.
     *
     * @param value the BigNumber or string used to initialize the object
     * @param decimals the number of decimal places supported by the number. If `number` is a string, this parameter is optional.
     * @returns a new, immutable instance of `DecimalBigNumber`
     */
    constructor(value: string, decimals?: number);
    constructor(value: BigNumber, decimals: number);
    getDecimals(): number;
    private _inferDecimalAmount;
    /**
     * Sets a value to a specific decimal amount
     *
     * Trims unnecessary decimals
     * Or pads decimals if needed
     *
     * @param value Input value as a string
     * @param decimals Desired decimal amount
     */
    private _setDecimalAmount;
    /**
     * Ensures the desired decimal amount is positive
     */
    private _ensurePositive;
    /**
     * Converts this value to a BigNumber
     *
     * Often used when passing this value as
     * an argument to a contract method
     */
    toBigNumber(decimals?: number): BigNumber;
    /**
     * Converts to a different decimal
     */
    reDecimal(decimals: number): DecimalBigNumber;
    /**
     * Converts this value to a string
     *
     * By default, the string returned will:
     * - Have the same decimal amount that it was initialized with
     * - Have trailing zeroes removed
     * - Not have thousands separators
     *
     * This ensures that the number string is accurate.
     *
     * To override any of these settings, add the `args` object as a parameter.
     *
     * @param args an object containing any of the properties: decimals, trim, format
     * @returns a string version of the number
     */
    toString({ decimals, trim, format }?: {
        trim?: boolean;
        format?: boolean;
        decimals?: number;
    }): string;
    /**
     * @deprecated
     * Please avoid using this method.
     * If used for calculations: rather than converting this DecimalBigNumber
     * "down" to a number, convert the other number "up" to a DecimalBigNumber.
     *
     * Used when performing approximate calculations with
     * the number where precision __is not__ important.
     *
     * Ex: (new DecimalBigNumber("100", 6)).toApproxNumber() => 100
     */
    toApproxNumber(): number;
    /**
     * Determines if the two values are equal
     */
    eq(value: DecimalBigNumber | string): boolean;
    /**
     * Subtracts this value by the value provided
     */
    sub(value: DecimalBigNumber | string): DecimalBigNumber;
    /**
     * Sums this value and the value provided
     */
    add(value: DecimalBigNumber | string): DecimalBigNumber;
    isPositive(): boolean;
    /**
     * Determines if this value is greater than the provided value
     */
    gt(value: DecimalBigNumber | string): boolean;
    /**
     * Determines if this value is greater than or equal to the provided value
     */
    gte(value: DecimalBigNumber | string): boolean;
    /**
     * Determines if this value is less than the provided value
     */
    lt(value: DecimalBigNumber | string): boolean;
    /**
     * Determines if this value is less than or equal to the provided value
     */
    lte(value: DecimalBigNumber | string): boolean;
    /**
     * Multiplies this value by the provided value
     */
    mul(value: DecimalBigNumber | string): DecimalBigNumber;
    mod(value: DecimalBigNumber | string): DecimalBigNumber;
    mulMod(value: DecimalBigNumber | string, denominator: DecimalBigNumber | string): DecimalBigNumber;
    mulDiv(value: DecimalBigNumber | string, denominator: DecimalBigNumber | string, rounding?: "up" | "down"): DecimalBigNumber;
    /**
     * Divides this value by the provided value
     *
     * By default, this returns a value whose decimal amount is equal
     * to the sum of the decimal amounts of the two values used.
     * If this isn't enough, you can specify a desired
     * decimal amount using the second function argument.
     *
     * @param decimals The expected decimal amount of the output value
     */
    div(value: DecimalBigNumber | string, decimals?: number): DecimalBigNumber;
    abs(): DecimalBigNumber;
    pow(n: number): DecimalBigNumber;
}
