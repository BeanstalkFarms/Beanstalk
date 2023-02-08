import { BigNumber, utils, constants } from "ethers";
import { DecimalBigNumber } from "src/lib/DecimalBigNumber";

const blocker = {};

export class TokenValue {
  static ZERO = TokenValue.fromHuman(0, 0);
  static NEGATIVE_ONE = TokenValue.fromHuman(-1, 0);
  static ONE = TokenValue.fromHuman(1, 0);
  static MAX_UINT32 = TokenValue.fromHuman(4294967295, 0);
  static MAX_UINT256 = TokenValue.fromBlockchain(constants.MaxUint256, 0);

  public humanString: string;
  public blockchainString: string;
  public decimals: number;
  public value: DecimalBigNumber;

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
  static fromHuman(value: string | number | BigNumber, decimals: number): TokenValue {
    if (typeof value === "string") return TokenValue.fromString(value, decimals);
    if (typeof value === "number") return TokenValue.fromString(value.toString(), decimals);
    if (value instanceof BigNumber) {
      // TODO: are we ok with this warning? should we add ability to ignore it?
      console.warn(
        "WARNING: calling TokenValue.fromHuman(BigNumber). This may have unexpected results. Are you sure you didn't mean TokenValue.fromBlockchain(BigNumber)?"
      );
      return TokenValue.fromString(value.toString(), decimals);
    }

    throw new Error("Invalid value parameter");
  }

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
  static fromBlockchain(value: string | number | BigNumber, decimals: number): TokenValue {
    if (typeof value === "string" || typeof value === "number") {
      const units = utils.formatUnits(value, decimals);
      return TokenValue.fromString(units, decimals);
    }
    if (value._isBigNumber) return TokenValue.fromBigNumber(value, decimals);

    throw new Error("Invalid value parameter");
  }

  /**
   * Create a TokenValue from another decimal-supporting object: DecimalBigNumber or TokenValue.
   *
   * @param value The amount
   * @returns a TokenValue
   */
  static from(value: DecimalBigNumber | TokenValue): TokenValue {
    if (value instanceof DecimalBigNumber) {
      return new TokenValue(blocker, value.toBigNumber(), value.getDecimals());
    }

    if (value instanceof TokenValue) return value;

    throw new Error('Invalid "value" parameter');
  }

  private static fromBigNumber(value: BigNumber, decimals: number): TokenValue {
    return new TokenValue(blocker, value, decimals);
  }

  private static fromString(value: string, decimals: number): TokenValue {
    if (!value) {
      throw new Error("Must provide value to BigNumber.fromHuman(value,decimals)");
    }
    if (decimals == undefined || decimals == null) {
      throw new Error("Must provide decimals to BigNumber.fromHuman(value,decimals)");
    }
    let [int, safeDecimals] = value.split(".");

    if (safeDecimals && safeDecimals.length > decimals) {
      safeDecimals = safeDecimals.substring(0, decimals);
    }

    const safeValue = safeDecimals ? `${int}.${safeDecimals}` : int;
    const result = utils.parseUnits(safeValue, decimals);

    return TokenValue.fromBigNumber(result, decimals);
  }

  constructor(_blocker: typeof blocker, _bigNumber: BigNumber, decimals: number) {
    if (_blocker !== blocker) throw new Error("Do not create an instance via the constructor. Use the .from...() methods");

    this.decimals = decimals;
    this.value = new DecimalBigNumber(_bigNumber, decimals);
    this.humanString = this.toHuman();
    this.blockchainString = this.toBlockchain();

    // make values immutable
    Object.defineProperty(this, "decimals", { configurable: false, writable: false });
    Object.defineProperty(this, "value", { configurable: false, writable: false });
  }

  ////// Utility Functions //////
  toBigNumber(): BigNumber {
    return this.value.toBigNumber();
  }

  toBlockchain(): string {
    return this.value.toBigNumber().toString();
  }

  /**
   * @deprecated
   * Ambiguous function. This exists only as a safety, otherwise the .toString()
   * call would go to Object.toString().
   * @returns
   */
  toString(): string {
    return this.toBlockchain();
  }

  toHex(): string {
    return this.value.toBigNumber()._hex;
  }

  /**
   * Returns a human readable string, for example "3.14"
   * @returns string
   */
  public toHuman(): string {
    return this.value.toString();
  }

  // Used mostly by the math functions to normalize the input
  private toDBN(num: TokenValue | BigNumber | number): DecimalBigNumber {
    if (num instanceof TokenValue) {
      return TokenValue.from(num).value;
    } else if (num instanceof BigNumber) {
      return TokenValue.fromBlockchain(num, 0).value;
    } else {
      const decimals = num.toString().split(".")[1]?.length || 0;
      return TokenValue.fromHuman(num, decimals).value;
    }
  }

  /**
   * Returns a new TokenValue with the number of decimals set to the new value
   * @param decimals
   */
  public reDecimal(decimals: number) {
    return TokenValue.from(this.value.reDecimal(decimals));
  }

  ////// Math Functions //////
  add(num: TokenValue | BigNumber | number): TokenValue {
    return TokenValue.from(this.value.add(this.toDBN(num)));
  }
  sub(num: TokenValue | BigNumber | number): TokenValue {
    return TokenValue.from(this.value.sub(this.toDBN(num)));
  }
  mod(num: TokenValue | number) {
    // num needs to have the same number of decimals as THIS
    let n = this.toDBN(num).reDecimal(this.decimals);
    return TokenValue.from(this.value.mod(n));
  }
  mul(num: TokenValue | number) {
    return TokenValue.from(this.value.mul(this.toDBN(num)).reDecimal(this.decimals));
  }
  mulMod(num: TokenValue | number, denominator: TokenValue | number): TokenValue {
    return TokenValue.from(this.value.mul(this.toDBN(num)).mod(this.toDBN(denominator).reDecimal(this.decimals)));
  }
  mulDiv(num: TokenValue | BigNumber | number, denominator: TokenValue | number, rounding?: "down" | "up") {
    return TokenValue.from(this.value.mulDiv(this.toDBN(num), this.toDBN(denominator), rounding).reDecimal(this.decimals));
  }
  div(num: TokenValue | BigNumber | number, decimals?: number) {
    return TokenValue.from(this.value.div(this.toDBN(num), decimals));
  }
  eq(num: TokenValue | BigNumber | number): boolean {
    return this.value.eq(this.toDBN(num));
  }
  gt(num: TokenValue | BigNumber | number): boolean {
    return this.value.gt(this.toDBN(num));
  }
  gte(num: TokenValue | BigNumber | number): boolean {
    return this.value.gte(this.toDBN(num));
  }
  lt(num: TokenValue | BigNumber | number): boolean {
    return this.value.lt(this.toDBN(num));
  }
  lte(num: TokenValue | BigNumber | number): boolean {
    return this.value.lte(this.toDBN(num));
  }
  static min(...values: TokenValue[]): TokenValue {
    return values.reduce((acc, num) => (acc.lt(num) ? acc : num));
  }
  static max(...values: TokenValue[]): TokenValue {
    return values.reduce((acc, num) => (acc.gt(num) ? acc : num));
  }
  abs(): TokenValue {
    return TokenValue.from(this.value.abs());
  }
  pow(num: number): TokenValue {
    return TokenValue.from(this.value.pow(num));
  }
  pct(num: number): TokenValue {
    const minDecimals = this.decimals < 2 ? 2 : this.decimals;
    if (num < 0) throw new Error("Percent value must be bigger than 0");
    return TokenValue.from(this.value.mul(num.toString()).div("100", minDecimals));
  }
}
