import { ERC20Token } from "@beanstalk/sdk-core";
import { Well__factory } from "src/constants/generated";
import { Well as WellContract } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";

export class Well {
  public sdk: WellsSDK;
  readonly address: string;
  readonly contract: WellContract;
  private lpToken: ERC20Token;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }
    Object.defineProperty(this, "sdk", {
      value: sdk
    });
    this.address = address;
    Object.defineProperty(this, "contract", {
      value: Well__factory.connect(address, sdk.providerOrSigner)
    });
  }

  /**
   * Get this Well's LP Token
   */
  async getLPToken(): Promise<ERC20Token> {
    if (!this.lpToken) {
      const token = new ERC20Token(this.sdk.chainId, this.address, undefined, undefined, undefined, this.sdk.provider);
      await token.loadFromChain();
      Object.defineProperty(this, "lpToken", {
        value: token
      });
    }

    return this.lpToken;
  }

  /**
   * Get the tradeable tokens paired in this Well
   */
  async tokens(): Promise<ERC20Token[]> {
    let addresses = await this.contract.tokens();
    const tokens: ERC20Token[] = [];

    for await (const address of addresses) {
      // First see this is a built in token provided by the SDK
      let token = this.sdk.tokens.findByAddress(address) as ERC20Token;

      // Otherwise build a Token instance from the address
      if (!token) {
        token = new ERC20Token(this.sdk.chainId, address, undefined, undefined, undefined, this.sdk.provider);
        await token.loadFromChain();
      }
      tokens.push(token);
    }

    return tokens;
  }

  /**
   * Returns the Well function of this well.
   * **Well functions** define a relationship between the reserves of the
   * tokens in the Well and the number of LP tokens.
   * 
   * @returns string address of the WellFunction
   * @todo - maybe return a WellFunction SDK object
   */
  async wellFunction() {}

  /**
   * Returns the Pumps attached to the Well as Call structs.
   */
  async pumps() {}

  // This is returns the same as [tokens(), wellFunction(), pumps()] in one call
  async well() {}

  async auger() {}

  ////// Swap FROM

  /**
   * @notice Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @return amountOut The amount of `toToken` received
   */
  async swapFrom() {}

  /**
   * @notice Gets the amount of `toToken` received for swapping an amount of `fromToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @return amountOut The amount of `toToken` to receive
   */
  async swapFromQuote() {}

  ////// Swap TO

  /**
   * @notice Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param maxAmountIn The maximum amount of `fromToken` to spend
   * @param amountOut The amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @return amountIn The amount of `toToken` received
   */
  async swapTo() {}

  /**
   * @notice Gets the amount of `fromToken` needed in order to receive a specific amount of `toToken`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountOut The amount of `toToken` desired
   * @return amountIn The amount of `fromToken` that must be spent
   */
  async swapToQuote() {}

  ////// Add Liquidity

  /**
   * @notice Adds liquidity to the Well as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @return lpAmountOut The amount of LP tokens received
   */
  addLiquidity() {}

  /**
   * @notice Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @return lpAmountOut The amount of LP tokens to receive
   */
  async addLiquidityQuote() {}

  ////// Remove Liquidity

  /**
   * @notice Removes liquidity from the Well as all underlying tokens in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @return tokenAmountsOut The amount of each underlying token received
   */
  async removeLiquidity() {} // address recipient // uint[] calldata minTokenAmountsOut, // uint lpAmountIn,

  /**
   * @notice Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @return tokenAmountsOut The amount of each underlying token to receive
   */
  async removeLiquidityQuote() {}

  /**
   * @notice Removes liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
   * @param recipient The address to receive the underlying tokens
   * @return tokenAmountOut The amount of `tokenOut` received
   */
  async removeLiquidityOneToken() {} // address recipient // uint minTokenAmountOut, // IERC20 tokenOut, // uint lpAmountIn,

  /**
   * @notice Gets the amount received from removing liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @return tokenAmountOut The amount of `tokenOut` to receive
   *
   * FIXME: ordering
   */
  async removeLiquidityOneTokenQuote() {} // IERC20 tokenOut // uint lpAmountIn,

  /**
   * @notice Removes liquidity from the Well as multiple underlying tokens in any ratio.
   * @param maxLpAmountIn The maximum amount of LP tokens to burn
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @return lpAmountIn The amount of LP tokens burned
   */
  async removeLiquidityImbalanced() {} // address recipient // uint[] calldata tokenAmountsOut, // uint maxLpAmountIn,

  /**
   * @notice Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @return lpAmountIn The amount of LP tokens to burn
   */
  async removeLiquidityImbalancedQuote() {} // uint[] calldata tokenAmountsOut

  ////// Other

  /**
   * @notice Gets the reserves of each token held by the Well.
   */
  async getReserves() {}

  /**
   * @notice Sends excess ERC-20 tokens held by the Well to the `recipient`.
   * @param recipient The address to send the tokens
   * @return skimAmounts The amount of each token skimmed
   */
  async skim(address: string) {}
}
