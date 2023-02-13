import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { BigNumber, CallOverrides, ContractTransaction, Overrides } from "ethers";
import { Well__factory } from "src/constants/generated";
import { Well as WellContract } from "src/constants/generated";

import { Auger } from "./Auger";
import { Pump } from "./Pump";
import { loadToken, setReadOnly, validateAddress, validateAmount, validateToken } from "./utils";
import { WellFunction } from "./WellFunction";
import { WellsSDK } from "./WellsSDK";

export type WellDetails = {
  tokens: ERC20Token[];
  wellFunction: WellFunction;
  pumps: Pump[];
  auger: Auger;
};

export type CallStruct = {
  target: string;
  data: string;
};

export type TxOverrides = Overrides & { from?: string };

export class Well {
  public sdk: WellsSDK;
  public address: string;
  public contract: WellContract;

  private name: string | undefined = undefined;
  private lpToken: ERC20Token | undefined = undefined;
  private tokens: ERC20Token[] | undefined = undefined;
  private wellFunction: WellFunction | undefined = undefined;
  private pumps: Pump[] | undefined = undefined;
  private auger: Auger | undefined = undefined;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }
    setReadOnly(this, "address", address, true);
    setReadOnly(this, "sdk", sdk, false);
    setReadOnly(this, "contract", Well__factory.connect(address, sdk.providerOrSigner), false);
  }

  /**
   * Retrieves all the well data and stores it in the Well object. Future
   * getXXX() calls will retrive the local data instead of making an RPC call.
   * Effectively caches data for:
   * - getName()
   * - getWell()
   * - getLPToken()
   * - getTokens()
   * - getWellFunction()
   * - getPumps()
   * - getAuger()
   * - getReserves()
   * */
  async loadWell() {
    await Promise.allSettled([this.getName(), this.getLPToken(), this.getWell(), this.getReserves()]);
  }

  /**
   * Get this Well's name
   */
  async getName(): Promise<string> {
    if (!this.name) {
      setReadOnly(this, "name", await this.contract.name());
    }

    return this.name!;
  }

  /**
   * Get this Well's LP Token
   */
  async getLPToken(): Promise<ERC20Token> {
    if (!this.lpToken) {
      const token = new ERC20Token(this.sdk.chainId, this.address, undefined, undefined, undefined, this.sdk.providerOrSigner);
      await token.loadFromChain();
      setReadOnly(this, "lpToken", token, true);
    }

    return this.lpToken!;
  }

  /**
   * Get the tradeable tokens paired in this Well
   */
  async getTokens(): Promise<ERC20Token[]> {
    if (!this.tokens) {
      await this.getWell();
    }

    return this.tokens!;
  }

  /**
   * Returns the Well function of this well.
   * **Well functions** define a relationship between the reserves of the
   * tokens in the Well and the number of LP tokens.
   *
   */
  async getWellFunction(): Promise<WellFunction> {
    if (!this.wellFunction) {
      await this.getWell();
    }

    return this.wellFunction!;
  }

  /**
   * Returns the Pumps attached to the Well.
   */
  async getPumps(): Promise<Pump[]> {
    if (!this.pumps) {
      await this.getWell();
    }
    return this.pumps!;
  }

  /**
   * Returns the Auger that bored this Well.
   * The Auger is a Well factory; it creates Wells based on "templates".
   */
  async getAuger(): Promise<Auger> {
    if (!this.auger) {
      await this.getWell();
    }

    return this.auger!;
  }

  /**
   * Returns the tokens, Well function, and Pump associated with this Well.
   *
   * This is an aggregate of calling these individual methods:
   * getTokens(), getWellFunction(), getPumps(), getAuger()
   *
   * Since this is one contract call, the other individual methods also
   * call this under the hood, getting other data cached for "free"
   */
  async getWell(): Promise<WellDetails> {
    const all = this.tokens && this.wellFunction && this.pumps && this.auger;

    if (!all) {
      const { _tokens, _wellFunction, _pumps, _auger } = await this.contract.well();

      // Tokens
      if (!this.tokens) {
        await this.setTokens(_tokens);
      }

      // Well Function
      if (!this.wellFunction) {
        this.setWellFunction(_wellFunction);
      }

      // Pumps
      if (!this.pumps) {
        this.setPumps(_pumps);
      }

      // Auger
      if (!this.auger) {
        this.setAuger(_auger);
      }
    }

    return { tokens: this.tokens!, wellFunction: this.wellFunction!, pumps: this.pumps!, auger: this.auger! };
  }

  private async setTokens(addresses: string[]) {
    let tokens: ERC20Token[] = [];
    for await (const address of addresses) {
      tokens.push(await loadToken(this.sdk, address));
    }
    Object.freeze(tokens);
    setReadOnly(this, "tokens", tokens, true);
  }

  private setWellFunction({ target, data }: CallStruct) {
    setReadOnly(this, "wellFunction", new WellFunction(target, data), true);
  }

  private setPumps(pumpData: CallStruct[]) {
    let pumps = (pumpData ?? []).map((p) => new Pump(p.target, p.data));
    Object.freeze(pumps);
    setReadOnly(this, "pumps", pumps, true);
  }

  private setAuger(address: string) {
    setReadOnly(this, "auger", new Auger(this.sdk, address), true);
  }

  ////// Swap FROM

  /**
   * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @return amountOut The amount of `toToken` received
   */
  async swapFrom(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");

    return this.contract.swapFrom(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of `toToken` received for swapping an amount of `fromToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @return amountOut The amount of `toToken` to receive
   */
  async swapFromQuote(fromToken: Token, toToken: Token, amountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");

    const amount = await this.contract.getSwapOut(fromToken.address, toToken.address, amountIn.toBigNumber(), overrides ?? {});

    return toToken.fromBlockchain(amount);
  }

  ////// Swap TO

  /**
   * Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param maxAmountIn The maximum amount of `fromToken` to spend
   * @param amountOut The amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @return amountIn The amount of `toToken` received
   */
  async swapTo(
    fromToken: Token,
    toToken: Token,
    maxAmountIn: TokenValue,
    amountOut: TokenValue,
    recipient: string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const from = fromToken.address;
    const to = toToken.address;
    const maxIn = maxAmountIn.toBigNumber();
    const out = amountOut.toBigNumber();

    return this.contract.swapTo(from, to, maxIn, out, recipient, overrides ?? {});
  }

  /**
   * Gets the amount of `fromToken` needed in order to receive a specific amount of `toToken`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountOut The amount of `toToken` desired
   * @return amountIn The amount of `fromToken` that must be spent
   */
  async swapToQuote(fromToken: Token, toToken: Token, amountOut: TokenValue, overrides?: CallOverrides): Promise<TokenValue> {
    const from = fromToken.address;
    const to = toToken.address;
    const amount = amountOut.toBigNumber();
    const quote = await this.contract.getSwapIn(from, to, amount, overrides ?? {});

    return fromToken.fromBlockchain(quote);
  }

  ////// Add Liquidity

  /**
   * Adds liquidity to the Well as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   */
  addLiquidity(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();

    return this.contract.addLiquidity(amountsIn, minLp, recipient, overrides ?? {});
  }

  /**
   * Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @return lpAmountOut The amount of LP tokens to receive
   */
  async addLiquidityQuote(tokenAmountsIn: TokenValue[], overrides?: CallOverrides): Promise<TokenValue> {
    await this.getLPToken();
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const result = await this.contract.getAddLiquidityOut(amountsIn, overrides ?? {});

    return this.lpToken!.fromBlockchain(result);
  }

  ////// Remove Liquidity

  /**
   * Removes liquidity from the Well as all underlying tokens in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @return tokenAmountsOut The amount of each underlying token received
   */
  async removeLiquidity(
    lpAmountIn: TokenValue,
    minTokenAmountsOut: TokenValue[],
    recipient: string,
    overrides?: CallOverrides
  ): Promise<ContractTransaction> {
    const lpAmount = lpAmountIn.toBigNumber();
    const minOutAmounts = minTokenAmountsOut.map((a) => a.toBigNumber());

    return this.contract.removeLiquidity(lpAmount, minOutAmounts, recipient, overrides ?? {});
  }

  /**
   * Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @return tokenAmountsOut The amount of each underlying token to receive
   */
  async removeLiquidityQuote(lpAmountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getRemoveLiquidityOut(lpAmountIn.toBigNumber(), overrides ?? {});
    const quote = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return quote;
  }

  /**
   * Removes liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
   * @param recipient The address to receive the underlying tokens
   * @return tokenAmountOut The amount of `tokenOut` received
   */
  async removeLiquidityOneToken(
    lpAmountIn: TokenValue,
    tokenOut: Token,
    minTokenAmountOut: TokenValue,
    recipient: string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const amountIn = lpAmountIn.toBigNumber();
    const token = tokenOut.address;
    const minOut = minTokenAmountOut.toBigNumber();

    return this.contract.removeLiquidityOneToken(amountIn, token, minOut, recipient, overrides ?? {});
  }

  /**
   * Gets the amount received from removing liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @return tokenAmountOut The amount of `tokenOut` to receive
   *
   */
  async removeLiquidityOneTokenQuote(lpAmountIn: TokenValue, tokenOut: Token, overrides?: CallOverrides): Promise<TokenValue> {
    const amountIn = lpAmountIn.toBigNumber();
    const address = tokenOut.address;

    const quote = await this.contract.getRemoveLiquidityOneTokenOut(amountIn, address, overrides ?? {});
    return tokenOut.fromBlockchain(quote);
  }

  /**
   * Removes liquidity from the Well as multiple underlying tokens in any ratio.
   * @param maxLpAmountIn The maximum amount of LP tokens to burn
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @return lpAmountIn The amount of LP tokens burned
   */
  async removeLiquidityImbalanced(
    maxLpAmountIn: TokenValue,
    tokenAmountsOut: TokenValue[],
    recipient: string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const maxIn = maxLpAmountIn.toBigNumber();
    const amounts = tokenAmountsOut.map((tv) => tv.toBigNumber());

    return this.contract.removeLiquidityImbalanced(maxIn, amounts, recipient, overrides ?? {});
  }

  /**
   * Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @return lpAmountIn The amount of LP tokens to burn
   */
  async removeLiquidityImbalancedQuote(tokenAmounts: TokenValue[], overrides?: CallOverrides): Promise<TokenValue> {
    const amounts = tokenAmounts.map((tv) => tv.toBigNumber());
    const quote = await this.contract.getRemoveLiquidityImbalancedIn(amounts, overrides ?? {});
    const lpToken = await this.getLPToken();

    return lpToken.fromBlockchain(quote);
  }

  ////// Other

  /**
   * Gets the reserves of each token held by the Well.
   */
  async getReserves(overrides?: CallOverrides): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getReserves(overrides ?? {});
    const quote = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return quote;
  }

  /**
   * Sends excess ERC-20 tokens held by the Well to the `recipient`.
   * @param recipient The address to send the tokens
   * @return skimAmounts The amount of each token skimmed
   */
  async skim(address: string, overrides?: TxOverrides): Promise<ContractTransaction> {
    return this.contract.skim(address, overrides ?? {});
  }
}
