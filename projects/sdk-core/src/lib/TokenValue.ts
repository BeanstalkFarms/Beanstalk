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
    if (typeof value === "number") {
      if (value.toString().includes("e")) {
        return TokenValue.fromString(value.toFixed(decimals), decimals);
      } else {
        return TokenValue.fromString(value.toString(), decimals);
      }
    }
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
  static fromBlockchain(value: string | number | BigInt | BigNumber, decimals: number): TokenValue {
    if (typeof value === "string" || typeof value === "number") {
      const units = utils.formatUnits(value, decimals);
      return TokenValue.fromString(units, decimals);
    }
    if (typeof value === "bigint") {
      return TokenValue.fromBigInt(value, decimals);
    }
    if ((value as BigNumber)._isBigNumber)
      return TokenValue.fromBigNumber(value as BigNumber, decimals);

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

  private static fromBigInt(value: BigInt, decimals: number): TokenValue {
    return new TokenValue(blocker, BigNumber.from(value), decimals);
  }

  constructor(_blocker: typeof blocker, _bigNumber: BigNumber, decimals: number) {
    if (_blocker !== blocker)
      throw new Error("Do not create an instance via the constructor. Use the .from...() methods");

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
   * @param format "short" for short format.
   * @returns string
   */
  public toHuman(format?: string): string {
    if (!format) return this.value.toString();

    if (format === "short") return this.friendlyFormat(this);

    throw new Error(`Unsupported formatting option: ${format}`);
  }

  public toNumber(): number {
    try {
      return parseFloat(this.toHuman());
    } catch (e) {
      throw new Error(`Could not convert ${this.toHuman()} to number`);
    }
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
    return TokenValue.from(
      this.value.mul(this.toDBN(num)).mod(this.toDBN(denominator).reDecimal(this.decimals))
    );
  }
  mulDiv(
    num: TokenValue | BigNumber | number,
    denominator: TokenValue | number,
    rounding?: "down" | "up"
  ) {
    return TokenValue.from(
      this.value.mulDiv(this.toDBN(num), this.toDBN(denominator), rounding).reDecimal(this.decimals)
    );
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
  subSlippage(slippage: number) {
    return this.pct(100 - slippage);
  }

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
  addSlippage(slippage: number) {
    return this.pct(100 + slippage);
  }

  /**
   * Formats a TokenValue to a human readable string that is abbreviated
   * @param tv TokenValue to format
   * @returns formatted string
   */
  friendlyFormat(tv: TokenValue): string {
    if (tv.eq(0)) return "0";

    if (tv.lte(TokenValue.fromHuman("0.00000001", 8))) return "<.00000001";

    if (tv.lte(TokenValue.fromHuman(1e-3, 3))) {
      return this.trimDecimals(tv, 8).toHuman();
    }

    const quadrillion = TokenValue.fromHuman(1e15, 0);
    if (tv.gte(quadrillion)) {
      return `${this.trimDecimals(tv.div(quadrillion), 4).toHuman()}Q`;
    }

    const trillion = TokenValue.fromHuman(1e12, 0);
    if (tv.gte(trillion)) {
      return `${this.trimDecimals(tv.div(trillion), 4).toHuman()}T`;
    }

    const billion = TokenValue.fromHuman(1e9, 0);
    if (tv.gte(billion)) {
      return `${this.trimDecimals(tv.div(billion), 3).toHuman()}B`;
    }

    const hmillion = TokenValue.fromHuman(1e8, 0);
    const millions = TokenValue.fromHuman(1e6, 0);
    if (tv.gte(hmillion)) {
      return `${this.trimDecimals(tv.div(millions), 2).toHuman()}M`;
    }
    if (tv.gte(millions)) {
      return `${this.trimDecimals(tv.div(millions), 2).toHuman()}M`;
    }

    if (tv.gte(TokenValue.fromHuman(1e3, 0))) {
      return tv.value.toApproxNumber().toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }

    const decimals = tv.gt(10) ? 2 : tv.gt(1) ? 3 : 4;
    return this.trimDecimals(tv, decimals).toHuman();
  }

  /**
   * Trims a TokenValue to a set number of decimals
   * @param tokenValue TokenValue to trim
   * @param decimals Number of decimals to trim to
   * @returns
   */
  public trimDecimals(tokenValue: TokenValue, decimals: number) {
    const tvString = tokenValue.toHuman();
    const decimalComponents = tvString.split(".");

    // No decimals, just return;
    if (decimalComponents.length < 2) return tokenValue;

    const numOfDecimals = decimalComponents[1].length;
    if (numOfDecimals <= decimals) return tokenValue;

    const decimalsToTrim = numOfDecimals - decimals;
    const newString = tvString.substring(0, tvString.length - decimalsToTrim);

    return TokenValue.fromHuman(newString, decimals);
  }
}
