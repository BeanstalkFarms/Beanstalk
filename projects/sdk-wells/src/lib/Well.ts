import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { BigNumber, CallOverrides, ContractTransaction, Overrides } from "ethers";
import { Well__factory } from "src/constants/generated";
import { Well as WellContract } from "src/constants/generated";

import { Aquifer } from "./Aquifer";
import { Pump } from "./Pump";
import {
  deadlineSecondsToBlockchain,
  loadToken,
  setReadOnly,
  validateAddress,
  validateAmount,
  validateAtleastOneNonZeroAmount,
  validateDeadline,
  validateToken
} from "./utils";
import { WellFunction } from "./WellFunction";
import { WellsSDK } from "./WellsSDK";

export type WellDetails = {
  tokens: ERC20Token[];
  wellFunction: WellFunction;
  pumps: Pump[];
  aquifer: Aquifer;
};

export type CallStruct = {
  target: string;
  data: string;
};

export type TxOverrides = Overrides & { from?: string };

export type PreloadOptions = {
  name?: boolean;
  lpToken?: boolean;
  tokens?: boolean;
  wellFunction?: boolean;
  pumps?: boolean;
  aquifer?: boolean;
  reserves?: boolean;
};

type CreateWellStaticParams = {
  address: string;
  name: string;
  wellFunction: WellFunction | CallStruct;
  pumps: Pump[] | CallStruct[];
  aquifer: Aquifer | string;
  lpToken: ERC20Token;
  tokens: ERC20Token[];
  wellData: string;
  reserves: BigNumber[];
};

export class Well {
  public sdk: WellsSDK;
  public address: string;
  public contract: WellContract;

  public name: string | undefined = undefined;
  public lpToken: ERC20Token | undefined = undefined;
  public tokens: ERC20Token[] | undefined = undefined;
  public wellFunction: WellFunction | undefined = undefined;
  public pumps: Pump[] | undefined = undefined;
  public aquifer: Aquifer | undefined = undefined;
  public reserves: TokenValue[] | undefined = undefined;
  public wellData: string | undefined = undefined;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }
    setReadOnly(this, "address", address, true);
    setReadOnly(this, "sdk", sdk, false);
    setReadOnly(this, "contract", Well__factory.connect(address, sdk.providerOrSigner), false);
  }

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
  async loadWell(options?: PreloadOptions): Promise<void> {
    // TODO: use a multicall
    const toLoad = [];

    if (!options) {
      toLoad.push(this.getName(), this.getLPToken(), this.getWell());
    } else {
      if (options.name) toLoad.push(this.getName());
      if (options.lpToken) toLoad.push(this.getLPToken());
      if (options.tokens || options.wellFunction || options.pumps || options.aquifer)
        toLoad.push(this.getWell());
    }

    await Promise.all(toLoad);

    // We have to do getReserves separately to avoid a race condition
    // with setToken(), where both .getWell() and .getReserves() call setToken()
    // at roughly the same time, causing the writing to .tokens twice, the second time
    // which would fail due to the readonly definition of the prop.
    if (!options || options.reserves) {
      await this.getReserves();
    }
  }

  /**
   * Create a Well with the given parameters.
   *
   * Expects all data to be fully initialized
   * Make sure to load all token data before calling this method.
   */
  static createWithParams(sdk: WellsSDK, params: CreateWellStaticParams) {
    const well = new Well(sdk, params.address);
    well.setName(params.name);
    well.setWellFunction(params.wellFunction);
    well.setPumps(params.pumps);
    well.setAquifer(params.aquifer instanceof Aquifer ? params.aquifer.address : params.aquifer);
    well.setLPToken(params.lpToken);
    well.setTokensWithTokens(params.tokens);
    well.setWellData(params.wellData);
    well.setReserves(params.tokens, params.reserves);
    return well;
  }

  /**
   * Get this Well's name
   */
  async getName(): Promise<string> {
    if (!this.name) {
      setReadOnly(this, "name", await this.contract.name(), true);
    }

    return this.name!;
  }

  /**
   * Set a Well's LP Token. For usage in Well.createWithParams()
   */
  private setLPToken(token: ERC20Token) {
    setReadOnly(this, "lpToken", token, true);
  }

  /**
   * Get this Well's LP Token
   */
  async getLPToken(): Promise<ERC20Token> {
    if (!this.lpToken) {
      const token = new ERC20Token(
        this.sdk.chainId,
        this.address,
        undefined,
        undefined,
        undefined,
        this.sdk.providerOrSigner
      );
      await token.loadFromChain();
      token.isLP = true;
      setReadOnly(this, "lpToken", token, true);
    }

    return this.lpToken!;
  }

  /**
   * Set the well data
   */
  setWellData(data: string) {
    setReadOnly(this, "wellData", data, true);
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
   * Returns the Aquifer that bored this Well.
   * The Aquifer is a Well factory; it creates Wells based on "templates".
   */
  async getAquifer(): Promise<Aquifer> {
    if (!this.aquifer) {
      await this.getWell();
    }

    return this.aquifer!;
  }

  /**
   * Returns the tokens, Well function, and Pump associated with this Well.
   *
   * This is an aggregate of calling these individual methods:
   * getTokens(), getWellFunction(), getPumps(), getAquifer()
   *
   * Since this is one contract call, the other individual methods also
   * call this under the hood, getting other data cached for "free"
   */
  async getWell(): Promise<WellDetails> {
    const all = this.tokens && this.wellFunction && this.pumps && this.aquifer;

    if (!all) {
      const { _tokens, _wellFunction, _pumps, _aquifer, _wellData } = await this.contract.well();

      if (!this.tokens) {
        await this.setTokens(_tokens);
      }

      if (!this.wellFunction) {
        this.setWellFunction(_wellFunction);
      }

      if (!this.pumps) {
        this.setPumps(_pumps);
      }

      if (!this.aquifer) {
        this.setAquifer(_aquifer);
      }

      if (!this.wellData) {
        this.wellData = _wellData;
      }
    }

    return {
      tokens: this.tokens!,
      wellFunction: this.wellFunction!,
      pumps: this.pumps!,
      aquifer: this.aquifer!
    };
  }

  private setName(name: string) {
    setReadOnly(this, "name", name, true);
  }

  /**
   * Set the tokens of the Well.
   *
   * @param _tokens The tokens to set.
   *
   * This method expects all tokens to be fully loaded.
   *
   * If you have the addresses of the tokens, use `setTokens(addresses: string[])`
   */
  private setTokensWithTokens(_tokens: ERC20Token[]) {
    const tokens = [..._tokens];
    Object.freeze(tokens);
    setReadOnly(this, "tokens", tokens, true);
  }

  private async setTokens(addresses: string[]) {
    let tokens: ERC20Token[] = [];

    for await (const address of addresses) {
      const existing = this.sdk.tokens.findByAddress(address);
      if (existing && existing instanceof ERC20Token) {
        tokens.push(existing);
      } else {
        tokens.push(await loadToken(this.sdk, address));
      }
    }
    Object.freeze(tokens);
    setReadOnly(this, "tokens", tokens, true);
  }

  private setWellFunction(params: CallStruct | WellFunction) {
    let wellFunction: WellFunction;
    if (params instanceof WellFunction) {
      wellFunction = params;
    } else {
      wellFunction = new WellFunction(this.sdk, params.target, params.data);
    }
    setReadOnly(this, "wellFunction", wellFunction, true);
  }

  private setPumps(pumpData: CallStruct[] | Pump[]) {
    let pumps = (pumpData ?? []).map((p, i) => {
      if (p instanceof Pump) return p;
      return new Pump(this.sdk, p.target, pumpData[i].data);
    });
    Object.freeze(pumps);
    setReadOnly(this, "pumps", pumps, true);
  }

  private setAquifer(address: string) {
    setReadOnly(this, "aquifer", new Aquifer(this.sdk, address), true);
  }

  getTokenByAddress(address: string): Token | undefined {
    return this.tokens?.find((t) => t.address === address.toLowerCase());
  }

  ////// Swap FROM

  /**
   * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  async swapFrom(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.swapFrom(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadlineBlockchain,
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
  async swapFromQuote(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");

    const amount = await this.contract.getSwapOut(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      overrides ?? {}
    );

    return toToken.fromBlockchain(amount);
  }

  /**
   * Estimate gas for `swapFrom()`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async swapFromGasEstimate(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: Overrides
  ): Promise<TokenValue> {
    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    if (!recipient) {
      return TokenValue.ZERO;
    }

    const gas = await this.contract.estimateGas.swapFrom(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );

    return TokenValue.fromBlockchain(gas, 0);
  }

  /**
   * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken` and supports
   * fee on transfer tokens.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  async swapFromFeeOnTransfer(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.swapFromFeeOnTransfer(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Estimage gas for `swapFromFeeOnTransfer()`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async swapFromFeeOnTransferGasEstimate(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: Overrides
  ): Promise<TokenValue> {
    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    if (!recipient) {
      return TokenValue.ZERO;
    }

    const gas = await this.contract.estimateGas.swapFromFeeOnTransfer(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );

    return TokenValue.fromBlockchain(gas, 0);
  }

  ////// Swap TO

  /**
   * Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param maxAmountIn The maximum amount of `fromToken` to spend
   * @param amountOut The amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  async swapTo(
    fromToken: Token,
    toToken: Token,
    maxAmountIn: TokenValue,
    amountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(maxAmountIn, "maxAmountIn");
    validateAmount(amountOut, "amountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const from = fromToken.address;
    const to = toToken.address;
    const maxIn = maxAmountIn.toBigNumber();
    const out = amountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.swapTo(
      from,
      to,
      maxIn,
      out,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of `fromToken` needed in order to receive a specific amount of `toToken`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountOut The amount of `toToken` desired
   * @return amountIn The amount of `fromToken` that must be spent
   */
  async swapToQuote(
    fromToken: Token,
    toToken: Token,
    amountOut: TokenValue,
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    const from = fromToken.address;
    const to = toToken.address;
    const amount = amountOut.toBigNumber();
    const quote = await this.contract.getSwapIn(from, to, amount, overrides ?? {});

    return fromToken.fromBlockchain(quote);
  }

  /**
   * Estimate gas for `swapTo()`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param maxAmountIn The maximum amount of `fromToken` to spend
   * @param amountOut The amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async swapToGasEstimate(
    fromToken: Token,
    toToken: Token,
    maxAmountIn: TokenValue,
    amountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<TokenValue> {
    const from = fromToken.address;
    const to = toToken.address;
    const maxIn = maxAmountIn.toBigNumber();
    const out = amountOut.toBigNumber();

    if (!recipient) {
      return TokenValue.ZERO;
    }

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.swapTo(
      from,
      to,
      maxIn,
      out,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  ////// Add Liquidity

  /**
   * Adds liquidity to the Well as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  addLiquidity(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    validateAtleastOneNonZeroAmount(tokenAmountsIn);
    validateAmount(minLpAmountOut, "minLpAmountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.addLiquidity(
      amountsIn,
      minLp,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @return lpAmountOut The amount of LP tokens to receive
   */
  async addLiquidityQuote(
    tokenAmountsIn: TokenValue[],
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    await this.getLPToken();
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const result = await this.contract.getAddLiquidityOut(amountsIn, overrides ?? {});

    return this.lpToken!.fromBlockchain(result);
  }

  /**
   * Estimate gas for addLiquidity()
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async addLiquidityGasEstimate(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string = "0x0000000000000000000000000000000000000000",
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<TokenValue> {
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.addLiquidity(
      amountsIn,
      minLp,
      recipient,
      deadlineBlockchain,
      overrides || {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  /**
   * Adds liquidity to the Well as multiple tokens in any ratio and supports
   * fee on transfer tokens.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  addLiquidityFeeOnTransfer(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    // TODO: validate at least one (or all?) is fee-on-transfer
    validateAtleastOneNonZeroAmount(tokenAmountsIn);
    validateAmount(minLpAmountOut, "minLpAmountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.addLiquidityFeeOnTransfer(
      amountsIn,
      minLp,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gas estimate for `addLiquidityFeeOnTransfer()`
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async addLiquidityFeeOnTransferGasEstimate(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<TokenValue> {
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.addLiquidityFeeOnTransfer(
      amountsIn,
      minLp,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  ////// Remove Liquidity

  /**
   * Removes liquidity from the Well as all underlying tokens in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with the executing transaction
   */
  async removeLiquidity(
    lpAmountIn: TokenValue,
    minTokenAmountsOut: TokenValue[],
    recipient: string,
    deadline?: number,
    overrides?: CallOverrides
  ): Promise<ContractTransaction> {
    validateAmount(lpAmountIn, "lpAmountIn");
    minTokenAmountsOut.forEach((v, i) => validateAmount(v, `minTokenAmountsOut[${i}]`));
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const lpAmount = lpAmountIn.toBigNumber();
    const minOutAmounts = minTokenAmountsOut.map((a) => a.toBigNumber());

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.removeLiquidity(
      lpAmount,
      minOutAmounts,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @return tokenAmountsOut The amount of each underlying token to receive
   */
  async removeLiquidityQuote(
    lpAmountIn: TokenValue,
    overrides?: CallOverrides
  ): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getRemoveLiquidityOut(
      lpAmountIn.toBigNumber(),
      overrides ?? {}
    );
    const quote = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return quote;
  }

  /**
   * Removes liquidity from the Well as all underlying tokens in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async removeLiquidityEstimateGas(
    lpAmountIn: TokenValue,
    minTokenAmountsOut: TokenValue[],
    recipient: string,
    deadline?: number,
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    const lpAmount = lpAmountIn.toBigNumber();
    const minOutAmounts = minTokenAmountsOut.map((a) => a.toBigNumber());

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.removeLiquidity(
      lpAmount,
      minOutAmounts,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  /**
   * Removes liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return tokenAmountOut The amount of `tokenOut` received
   */
  async removeLiquidityOneToken(
    lpAmountIn: TokenValue,
    tokenOut: Token,
    minTokenAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    validateAmount(lpAmountIn, "lpAmountIn");
    validateToken(tokenOut, "tokenOut");
    validateAmount(minTokenAmountOut, "minTokenAmountOut");
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const amountIn = lpAmountIn.toBigNumber();
    const token = tokenOut.address;
    const minOut = minTokenAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.removeLiquidityOneToken(
      amountIn,
      token,
      minOut,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount received from removing liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @return tokenAmountOut The amount of `tokenOut` to receive
   *
   */
  async removeLiquidityOneTokenQuote(
    lpAmountIn: TokenValue,
    tokenOut: Token,
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    const amountIn = lpAmountIn.toBigNumber();
    const address = tokenOut.address;

    const quote = await this.contract.getRemoveLiquidityOneTokenOut(
      amountIn,
      address,
      overrides ?? {}
    );
    return tokenOut.fromBlockchain(quote);
  }

  /**
   * Estimate gas for `removeLiquidityOneToken()`
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async removeLiquidityOneTokenGasEstimate(
    lpAmountIn: TokenValue,
    tokenOut: Token,
    minTokenAmountOut: TokenValue,
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<TokenValue> {
    validateDeadline(deadline);
    const amountIn = lpAmountIn.toBigNumber();
    const token = tokenOut.address;
    const minOut = minTokenAmountOut.toBigNumber();

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.removeLiquidityOneToken(
      amountIn,
      token,
      minOut,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  /**
   * Removes liquidity from the Well as multiple underlying tokens in any ratio.
   * @param maxLpAmountIn The maximum amount of LP tokens to burn
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Promise with executing transaction
   */
  async removeLiquidityImbalanced(
    maxLpAmountIn: TokenValue,
    tokenAmountsOut: TokenValue[],
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    validateAmount(maxLpAmountIn, "maxLpAmountIn");
    tokenAmountsOut.forEach((t, i) => validateAmount(t, `tokenAmountsOut[${i}]`));
    validateAddress(recipient, "recipient");
    validateDeadline(deadline);
    const maxIn = maxLpAmountIn.toBigNumber();
    const amounts = tokenAmountsOut.map((tv) => tv.toBigNumber());

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    return this.contract.removeLiquidityImbalanced(
      maxIn,
      amounts,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @return lpAmountIn The amount of LP tokens to burn
   */
  async removeLiquidityImbalancedQuote(
    tokenAmounts: TokenValue[],
    overrides?: CallOverrides
  ): Promise<TokenValue> {
    const amounts = tokenAmounts.map((tv) => tv.toBigNumber());
    const quote = await this.contract.getRemoveLiquidityImbalancedIn(amounts, overrides ?? {});
    const lpToken = await this.getLPToken();

    return lpToken.fromBlockchain(quote);
  }

  /**
   * Estimate gas for `removeLiquidityImbalanced()`
   * @param maxLpAmountIn The maximum amount of LP tokens to burn
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param deadline The transaction deadline in seconds (defaults to MAX_UINT256)
   * @return Estimated gas needed
   */
  async removeLiquidityImbalancedEstimateGas(
    maxLpAmountIn: TokenValue,
    tokenAmountsOut: TokenValue[],
    recipient: string,
    deadline?: number,
    overrides?: TxOverrides
  ): Promise<TokenValue> {
    validateDeadline(deadline);
    const maxIn = maxLpAmountIn.toBigNumber();
    const amounts = tokenAmountsOut.map((tv) => tv.toBigNumber());

    const deadlineBlockchain = deadline
      ? deadlineSecondsToBlockchain(deadline)
      : TokenValue.MAX_UINT256.toBlockchain();

    const gas = await this.contract.estimateGas.removeLiquidityImbalanced(
      maxIn,
      amounts,
      recipient,
      deadlineBlockchain,
      overrides ?? {}
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  ////// Other

  /**
   * Shifts excess tokens held by the Well into liquidity and delivers to `recipient` `minAmountOut` LP tokens.
   */
  async sync(
    minAmountOut: TokenValue,
    recipient: string,
    overrides?: CallOverrides
  ): Promise<ContractTransaction> {
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");

    return this.contract.sync(recipient, minAmountOut.toBigNumber(), overrides ?? {});
  }

  /**
   * Sends excess ERC-20 tokens held by the Well to the `recipient`.
   * @param recipient The address to send the tokens
   * @return skimAmounts The amount of each token skimmed
   */
  async skim(address: string, overrides?: TxOverrides): Promise<ContractTransaction> {
    return this.contract.skim(address, overrides ?? {});
  }

  /**
   * Shifts excess tokens held by the Well into `toToken` and delivers to `recipient`.
   * @param toToken The token to shift into
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive the token
   * @return amountOut The amount of `toToken` received
   */
  async shift(
    toToken: Token,
    minAmountOut: TokenValue,
    recipient: string,
    overrides?: CallOverrides
  ): Promise<ContractTransaction> {
    validateToken(toToken, "toToken");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");

    return this.contract.shift(
      toToken.address,
      minAmountOut.toBigNumber(),
      recipient,
      overrides ?? {}
    );
  }

  /**
   * Calculates the amount of the token out received from shifting excess tokens held by the Well.
   * @param tokenOut The token to shift into
   * @return amountOut The amount of `tokenOut` received
   */
  async shiftQuote(toToken: Token): Promise<TokenValue> {
    const amount = await this.contract.getShiftOut(toToken.address);
    return toToken.fromBlockchain(amount);
  }

  /**
   * Set the reserves of the Well.
   *
   * @param tokens The tokens to set the reserves for.
   * @param reserves The reserves to set.
   *
   * Ensure that the reserves are set in the same order as the tokens.
   */
  setReserves(tokens: ERC20Token[], reserves: BigNumber[]) {
    this.reserves = reserves.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));
  }

  /**
   * Gets the reserves of each token held by the Well.
   */
  async getReserves(overrides?: CallOverrides): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getReserves(overrides ?? {});
    this.reserves = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return this.reserves;
  }

  static DeployContract(sdk: WellsSDK): Promise<WellContract> {
    if (!sdk.signer) {
      throw new Error("WellSDK must have a signer to deploy a well");
    }
    const wellContract = new Well__factory(sdk.signer);
    return wellContract.deploy();
  }

  /**
   * Static function to deploy a well
   * @param tokens
   * @param name
   * @param symbol
   * @param wellFunction
   */
  static async DeployViaAquifer(
    sdk: WellsSDK,
    aquifer: Aquifer,
    tokens: ERC20Token[],
    wellFunction: WellFunction,
    pumps: Pump[]
  ): Promise<Well> {
    if (tokens.length < 2) {
      throw new Error("Well must have at least 2 tokens");
    }

    // Well implementation
    const wellContract = new Well__factory(sdk.signer);
    const deployedWell = await wellContract.deploy();

    const well = await aquifer.boreWell(deployedWell.address, tokens, wellFunction, pumps);

    return well;
  }

  /**
   * Returns a JSON string representation of the Well of
   * - chainId
   * - name
   * - wellData
   * - lpToken: { address, symbol, decimals, name }
   * - tokens: { address, symbol, decimals, name }[]
   * - wellFunction: { symbol, name, data, address }
   * - pumps: { address, data }[]
   * - aquifer: { address }
   * - reserves: { address, amount }[]
   */
  toJSON() {
    const asObj = {
      chainId: this.sdk.chainId,
      name: this.name,
      lpToken: {
        address: this.lpToken?.address,
        symbol: this.lpToken?.symbol,
        decimals: this.lpToken?.decimals,
        name: this.lpToken?.name
      },
      tokens: this.tokens?.map((token) => ({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name
      })),
      wellFunction: {
        symbol: this.wellFunction?.symbol,
        name: this.wellFunction?.name,
        data: this.wellFunction?.data,
        address: this.wellFunction?.address
      },
      pumps: this.pumps?.map((pump) => ({
        address: pump.address,
        data: pump.data
      })),
      aquifer: this.aquifer?.address,
      reserves: this.reserves?.map((reserve) => reserve.blockchainString),
      wellData: this.wellData
    };
    return JSON.stringify(asObj, null, 2);
  }

  /**
   * TODO: Implement Deploy() that deploys a well without an aquifer
   */
}
