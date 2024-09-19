export interface ZeroExQuoteParams extends ZeroExAPIRequestParams {
  mode: "exactInput" | "exactOutput";
  enabled: boolean;
}

export interface ZeroExAPIRequestParams {
  /**
   * The ERC20 token address of the token you want to sell. It is recommended to always use the token address
   * instead of token symbols (e.g. ETH ) which may not be recognized by the API.
   */
  sellToken: string;
  /**
   * The ERC20 token address of the token you want to receive. It is recommended to always use the token address
   * instead of token symbols (e.g. ETH ) which may not be recognized by the API.
   */
  buyToken: string;
  /**
   * (Optional) The amount of sellToken (in sellToken base units) you want to send. Either sellAmount or buyAmount
   * must be present in a request. Specifying sellAmount is the recommended way to interact with
   * 0x API as it covers all on-chain sources.
   */
  sellAmount?: string;
  /**
   * (Optional) The amount of buyToken(in buyToken base units) you want to receive. Either sellAmount
   * or buyAmount must be present in a request. Note that some on-chain sources do not allow
   * specifying buyAmount, when using buyAmount these sources are excluded.
   */
  buyAmount?: string;
  /**
   * (Optional, default is 0.01 for 1%) The maximum acceptable slippage of the buyToken amount if sellAmount
   * is provided; The maximum acceptable slippage of the sellAmount amount if buyAmount is provided
   * (e.g. 0.03 for 3% slippage allowed). The lowest possible value that can be set for this parameter
   * is 0; in other words, no amount of slippage would be allowed. If no value for this optional parameter is
   * provided in the API request, the default slippage percentage is 1%.
   */
  slippagePercentage?: string;
  /**
   * (Optional, defaults to ethgasstation "fast") The target gas price (in wei) for the swap transaction.
   * If the price is too low to achieve the quote, an error will be returned.
   */
  gasPrice?: string;
  /**
   * (Optional) The address which will fill the quote. While optional, we highly recommend providing this
   * parameter if possible so that the API can more accurately estimate the gas required for the swap transaction.
   * This helps when validating the entire transaction for success, and catches revert issues. If the validation
   * fails, a Revert Error will be returned in the response. The quote should be fillable if this address is provided.
   *
   * Also, make sure this address has enough token balance. Additionally, including the takerAddress is required
   * if you want to integrate RFQ liquidity.
   */
  takerAddress?: string;
  /**
   * (Optional) Liquidity sources (Uniswap, SushiSwap, 0x, Curve, etc) that will not be included in the provided quote.
   * See the docs for a full list of sources.
   *
   * This parameter cannot be combined with includedSources.
   */
  excludedSources?: string;
  /**
   * (Optional) Typically used to filter for RFQ liquidity without any other DEX orders which this is useful
   * for testing your RFQ integration. To do so, set it to 0x.
   *
   * This parameter cannot be combined with excludedSources.
   */
  includedSources?: string;
  /**
   * (Optional) Normally, whenever a takerAddress is provided, the API will validate the quote for the user.
   *
   * For more details, see "How does takerAddress help with catching issues?" in the docs.
   *
   * When this parameter is set to true, that validation will be skipped.
   *
   * Also see Quote Validation in the docs. .
   */
  skipValidation?: boolean;
  /**
   * (Optional) The ETH address that should receive affiliate fees specified with buyTokenPercentageFee.
   * Can be used combination with buyTokenPercentageFee to set a commission/trading fee when using the API.
   *
   * Learn more about how to setup a trading fee/commission fee/transaction fee in the FAQs.
   */
  feeRecipient?: string;
  /**
   * (Optional) The percentage (denoted as a decimal between 0 - 1.0 where 1.0 represents 100%) of
   * the buyAmount that should be attributed to feeRecipient as affiliate fees. Note that this requires
   * that the feeRecipient parameter is also specified in the request. Learn more about how to setup
   * a trading fee/commission fee/transaction fee in the FAQs.
   */
  buyTokenPercentageFee?: string;
  /**
   * (Optional, defaults to 100%) The percentage (between 0 - 1.0) of allowed price impact.
   *
   * When priceImpactProtectionPercentage is set, estimatedPriceImpact is returned which estimates the change
   * in the price of the specified asset that would be caused by the executed swap due to price impact.
   *
   * If the estimated price impact is above the percentage indicated, an error will be returned. For example,
   * if PriceImpactProtectionPercentage=.15 (15%), any quote with a price impact higher than 15% will return an error.
   *
   * This is an opt-in feature, the default value of 1.0 will disable the feature. When it is set to 1.0 (100%)
   * it means that every transaction is allowed to pass.
   *
   * Note: When we fail to calculate Price Impact we will return null and Price Impact Protection will be disabled
   * See affects on estimatedPriceImpact in the Response fields. Read more about price
   * impact protection and how to set it up in the docs.
   */
  priceImpactProtectionPercentage?: string;
  /**
   * (Optional) The recipient address of any trade surplus fees. If specified, this address will collect trade surplus
   * when applicable. Otherwise, trade surplus will not be collected.
   *
   * Note: Trade surplus is only sent to this address for sells. It is a no-op for buys.
   * Read more about "Can I collect trade surplus?" in the FAQs.
   */
  feeRecipientTradeSurplus?: string;
  /**
   * (Optional) A boolean field. If set to true, the 0x Swap API quote request should sell the entirety of the
   * caller's takerToken balance. A sellAmount is still required, even if it is a best guess, because it is
   * how a reasonable minimum received amount is determined after slippage.
   *
   * Note: This parameter is only required for special cases, such as when setting up a multi-step transaction
   * or composable operation, where the entire balance is not known ahead of time. Read more about
   * "Is there a way to sell assets via Swap API if the exact sellToken amount is not known
   * before the transaction is executed?" in the FAQs.
   */
  shouldSellEntireBalance?: boolean;
}

interface ZeroExOrder {
  type: number;
  source: string;
  makerToken: string;
  takerToken: string;
  makerAmount: string;
  takerAmount: string;
  fillData: any;
  fill: any;
}

interface ZeroExFee {
  feeType: string | "volume";
  feeToken: string;
  feeAmount: string;
  billingType: string | "on-chain";
}

interface ZeroExSource {
  name: string;
  proportion: string;
}

/**
 * Response type from 0x quote-v1 swap API.
 *
 * @link https://0x.org/docs/1.0/0x-swap-api/api-references/get-swap-v1-quote
 */
export interface ZeroExQuoteResponse {
  /**
   *
   */
  chainId: number;
  /**
   * If {buyAmount} was specifed in the request, it provides the price of buyToken in sellToken & vice versa.
   * Does not include slippage
   */
  price: string;
  /**
   * Similar to price, but with fees removed from the price calculation. Price as if not fee is charged.
   */
  grossPrice: string;
  /**
   * When priceImpactProtectionPercentage is set, this value returns the estimated change in the price of
   * the specified asset that would be caused by the executed swap.
   */
  estimatedPriceImpact: string | null;
  /**
   * The amount of ether (in wei) that should be sent with the transaction.
   */
  value: string;
  /**
   * The gas price (in wei) that should be used to send the transaction.
   * The transaction needs to be sent with this gasPrice or lower for the transaction to be successful.
   */
  gasPrice: string;
  /**
   * The estimated gas limit that should be used to send the transaction to guarantee settlement.
   * While a computed estimate is returned in all responses, an accurate estimate will only be returned if
   * a takerAddress is included in the request.
   */
  gas: string;
  /**
   * The estimate for the amount of gas that will actually be used in the transaction. Always less than gas.
   */
  estimatedGas: string;
  /**
   * The maximum amount of ether (in wei) that will be paid towards the protocol fee, and what is used to compute the value field of the transaction.
   * Note, as of ZEIP-91, protocol fees have been removed for all order types.
   */
  protocolFee: string;
  /**
   * The minimum amount of ether (in wei) that will be paid towards the protocol fee during the transaction.
   */
  minimumProtocolFee: string;
  /**
   * The ERC20 token address of the token you want to receive in quote.
   */
  buyTokenAddress: string;
  /**
   * The amount of buyToken (in buyToken units) that would be bought in this swap.
   * Certain on-chain sources do not allow specifying buyAmount, when using buyAmount these sources are excluded.
   */
  buyAmount: string;
  /**
   * Similar to buyAmount but with fees removed. This is the buyAmount as if no fee is charged.
   */
  grossBuyAmount: string;
  /**
   * The ERC20 token address of the token you want to sell with quote.
   */
  sellTokenAddress: string;
  /**
   * The amount of sellToken (in sellToken units) that would be sold in this swap.
   * Specifying sellAmount is the recommended way to interact with 0xAPI as it covers all on-chain sources.
   */
  sellAmount: string;
  /**
   * Similar to sellAmount but with fees removed.
   * This is the sellAmount as if no fee is charged.
   * Note: Currently, this will be the same as sellAmount as fees can only be configured to occur on the buyToken.
   */
  grossSellAmount: string;
  /**
   * The percentage distribution of buyAmount or sellAmount split between each liquidity source.
   */
  sources: ZeroExSource[];
  /**
   * The target contract address for which the user needs to have an allowance in order to be able to complete the swap.
   * Typically this is the 0x Exchange Proxy contract address for the specified chain.
   * For swaps with "ETH" as sellToken, wrapping "ETH" to "WETH" or unwrapping "WETH" to "ETH" no allowance is needed,
   * a null address of 0x0000000000000000000000000000000000000000 is then returned instead.
   */
  allowanceTarget: string;
  /**
   * The rate between ETH and sellToken
   */
  sellTokenToEthRate: string;
  /**
   * The rate between ETH and buyToken
   */
  buyTokenToEthRate: string;
  /**
   * The address of the contract to send call data to.
   */
  to: string;
  /**
   *
   */
  from: string;
  /**
   * The call data
   */
  data: string;
  /**
   * The price which must be met or else the entire transaction will revert. This price is influenced by the slippagePercentage parameter.
   * On-chain sources may encounter price movements from quote to settlement.
   */
  guaranteedPrice: string;
  /**
   * The details used to fill orders, used by market makers. If orders is not empty, there will be a type on each order.
   * For wrap/unwrap, orders is empty. otherwise, should be populated.
   */
  orders: ZeroExOrder[];
  /**
   * 0x Swap API fees that would be charged.
   */
  fees: Record<string, ZeroExFee>;
  /**
   *
   */
  decodedUniqueId: string;
  /**
   *
   */
  auxiliaryChainData: any;
}
