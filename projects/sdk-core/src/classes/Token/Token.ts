import { BigNumber, BaseContract, ContractTransaction, ethers, utils, providers } from "ethers";
import { TokenValue } from "../TokenValue";
import { PromiseOrValue } from "src/constants/generated/common";

type TokenMetadata = {
  name?: string;
  displayName?: string;
  logo?: string;
  color?: string;
  displayDecimals?: number;
  isLP?: boolean;
};

export abstract class Token {
  private static provider?: providers.Provider;

  /** The chain id of the chain this token lives on */
  public chainId: number;

  /** The contract address on the chain on which this token lives */
  public address: string;

  /** The decimals used in representing currency amounts */
  public decimals: number;

  /** Provider for chain interactions */

  /** The name of the currency, i.e. a descriptive textual non-unique identifier */
  public name: string = "Unknown";

  /** The display name of the currency, i.e. a descriptive textual non-unique identifier */
  public displayName: string = "Unknown Token";

  /** The symbol of the currency, i.e. a short textual non-unique identifier */
  public symbol: string;

  /** The square logo of the token. */
  public logo?: string;

  /** The color to use when displaying the token in charts, etc. */
  public color?: string;

  /** The number of decimals this token is recommended to be truncated to. */
  public displayDecimals: number;

  /** Whether or not this is a LP token representing a position in a Pool. */
  public isLP: boolean = false;

  constructor(
    chainId: number,
    address: string | null,
    decimals?: number,
    symbol?: string,
    metadata?: TokenMetadata,
    provider?: providers.Provider
  ) {
    this.chainId = chainId;
    this.address = address?.toLowerCase() ?? "";

    this.decimals = decimals ?? 0;
    this.symbol = symbol ?? "UNKNOWN";
    Token.provider = provider;

    this.name = metadata?.name ?? "Unknown";
    this.displayName = metadata?.displayName ?? "Unknown Token";
    this.displayDecimals = metadata?.displayDecimals ?? 2;
    this.logo = metadata?.logo;
    this.color = metadata?.color;
    this.isLP = metadata?.isLP || false;
  }

  abstract getContract(): BaseContract | null;

  abstract getBalance(account: string): Promise<TokenValue>;

  abstract getAllowance(account: string, spender: string): Promise<TokenValue | undefined>;

  abstract hasEnoughAllowance(account: string, spender: string, amount: TokenValue | ethers.BigNumber): boolean | Promise<boolean>;

  abstract getTotalSupply(): Promise<TokenValue> | undefined;

  setProvider(provider: providers.Provider) {
    Token.provider = provider;
  }

  getProvider(): providers.Provider {
    if (!Token.provider) throw new Error("Provider not set");
    return Token.provider;
  }

  /**
   * Returns whether this currency is functionally equivalent to the other currency
   * @param other the other currency
   */
  public equals(other: Token): boolean {
    return this.address === other.address && this.chainId === other.chainId;
  }

  public toString(): string {
    return this.name;
  }

  public setMetadata(metadata: { logo?: string; color?: string }) {
    if (metadata.logo) this.logo = metadata.logo;
    if (metadata.color) this.color = metadata.color;
  }

  /**
   * Converts from a blockchain amount to a TokenValue with this token's decimals set
   *
   * Ex: BEAN.fromBlockchain("3140000") => TokenValue holding value "3140000" and 6 decimals
   *
   * @param amount A string value in blockchain format
   * @returns TokenValue
   */
  fromBlockchain(amount: string | number | BigNumber): TokenValue {
    return TokenValue.fromBlockchain(amount, this.decimals);
  }

  /**
   * Converts from a human amount to a TokenAmount with this token's decimals set
   *
   * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
   *
   * @param amount human readable amout, ex: "3.14" ether
   * @returns TokenValue
   */
  fromHuman(amount: string | number): TokenValue {
    return TokenValue.fromHuman(amount, this.decimals);
  }

  /**
   * Alias to `.fromHuman()`
   *
   * Converts from a human amount to a TokenAmount with this token's decimals set
   *
   * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
   *
   * @param amount human readable amout, ex: "3.14" ether
   * @returns TokenValue
   */
  amount(amount: string | number): TokenValue {
    return this.fromHuman(amount);
  }

  /**
   * Converts from a blockchain value to a human readable form
   *
   * Ex: BEAN.toHuman(BigNumber.from('3140000)) => "3.14"
   * @param value A BigNumber with a value of this token, for ex: 1000000 would be 1 BEAN
   * @returns string
   */
  toHuman(value: BigNumber): string {
    return utils.formatUnits(value, this.decimals);
  }

  toTokenValue(value: BigNumber): TokenValue {
    return TokenValue.fromBlockchain(value, this.decimals);
  }

  public approve(spenderContract: PromiseOrValue<string>, amount: TokenValue | BigNumber): Promise<ContractTransaction> {
    // @ts-ignore
    return;
  }
}
