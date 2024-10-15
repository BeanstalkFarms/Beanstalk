import {
  BeanstalkSDK,
  BeanSwapOperation,
  ERC20Token,
  FarmFromMode,
  NativeToken,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { SupportedChainId, BEAN_WSTETH_ADDRESSS } from '~/constants';
import { getChainConstant } from '~/util/Chain';

export class BuyFertilizerFarmStep extends FarmStep {
  private _tokenList: (ERC20Token | NativeToken)[];

  constructor(
    _sdk: BeanstalkSDK,
    private _account: string
  ) {
    super(_sdk);
    this._account = _account;
    this._tokenList = BuyFertilizerFarmStep.getTokenList(_sdk.tokens);
  }

  build(
    tokenIn: Token,
    amountIn: TokenValue,
    _fromMode: FarmFromMode,
    claimAndDoX: ClaimAndDoX,
    ethPrice: TokenValue,
    slippage: number,
    operation: BeanSwapOperation | undefined,
    claimOperation: BeanSwapOperation | undefined
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const { wstETHIn } = BuyFertilizerFarmStep.validateTokenIn(
      this._sdk.tokens,
      this._tokenList,
      tokenIn
    );

    const setInput = () => {
      this.pushInput({
        input: async (_amountInStep) => {
          const amountWstETH =
            this._sdk.tokens.WSTETH.fromBlockchain(_amountInStep);
          const amountFert = this.getFertFromWstETH(amountWstETH, ethPrice);
          const minLP = await this.calculateMinLP(amountWstETH, ethPrice);

          return {
            name: 'mintFertilizer',
            amountOut: _amountInStep,
            prepare: () => ({
              target: beanstalk.address,
              callData: beanstalk.interface.encodeFunctionData(
                'mintFertilizer',
                [
                  amountWstETH.toBlockchain(), // wstETHAmountIn
                  amountFert.toBlockchain(), // minFertilizerOut
                  minLP.subSlippage(slippage).toBlockchain(), // minLPTokensOut (with slippage applied)
                ]
              ),
            }),
            decode: (data: string) =>
              beanstalk.interface.decodeFunctionData('mintFertilizer', data),
            decodeResult: (result: string) =>
              beanstalk.interface.decodeFunctionResult(
                'mintFertilizer',
                result
              ),
          };
        },
      });
    };

    /// If the user is not using additional BEANs
    if (!wstETHIn && operation) {
      this.pushInput({
        input: [...operation.getFarm().generators],
      });
      setInput();
    }

    if (wstETHIn && !operation) {
      setInput();
    }

    if (claimOperation) {
      this.pushInput({
        input: [...claimOperation.getFarm().generators],
      });
      setInput();
    }

    this.pushInput(claimAndDoX.getTransferStep(this._account));

    console.debug('[BuyFertilizerFarmStep][build] steps', this.getFarmInput());

    return this;
  }

  // eslint-disable-next-line class-methods-use-this
  getFertFromWstETH(amount: TokenValue, wstETHPrice: TokenValue) {
    return amount.mul(wstETHPrice).reDecimal(0);
  }

  // private methods

  /**
   *  The steps for calculating minLP given wstETH amount are:
   * 1. usdAmountIn = wstETHPrice / wethUsdcPrice (or wstETHAmountIn * usdcWstETH. Let's make sure to use  getMintFertilizerOut(1000000)
   *    or the function that I will add to make sure it uses the same wethUsdc price as the contract or otherwise the amount out could be off)
   * 2. beansMinted = usdAmountIn * 0.866616  (Because Beanstalk mints 0.866616 Beans for each $1 contributed)
   * 3. lpAmountOut = beanWstETHWell.getAddLiquidityOut([beansMinted, wethAmountIn])
   *
   * Apply slippage minLPTokensOut = lpAmountOut * (1 - slippage)
   */
  // eslint-disable-next-line class-methods-use-this
  private async calculateMinLP(
    wstETHAmount: TokenValue,
    wstETHPrice: TokenValue
  ): Promise<TokenValue> {
    const beanWstETHWellAddress = getChainConstant(
      BEAN_WSTETH_ADDRESSS,
      SupportedChainId.ARBITRUM_MAINNET
    ).toLowerCase();
    const well = await this._sdk.wells.getWell(beanWstETHWellAddress);

    const usdAmountIn = wstETHPrice.mul(wstETHAmount);
    const beansToMint = usdAmountIn.mul(0.866616);
    const lpEstimate = await well.addLiquidityQuote([
      beansToMint,
      wstETHAmount,
    ]);

    return lpEstimate;
  }

  /// Static Methods

  public static async getAmountOut(
    sdk: BeanstalkSDK,
    tokenList: Token[],
    tokenIn: Token,
    amountIn: TokenValue,
    slippage: number
  ) {
    BuyFertilizerFarmStep.validateTokenIn(sdk.tokens, tokenList, tokenIn);

    const quote = await sdk.beanSwap.quoter.route(
      tokenIn as ERC20Token,
      sdk.tokens.WSTETH,
      amountIn,
      slippage
    );

    if (!quote) {
      throw new Error('Unable to build swap.');
    }

    const amountOut = quote.buyAmount;

    return {
      amountOut,
      beanSwapQuote: quote,
    };
  }

  public static getTokenList(tokens: BeanstalkSDK['tokens']) {
    return BuyFertilizerFarmStep.getPreferredTokens(tokens).map(
      ({ token }) => token
    );
  }

  public static getPreferredTokens(tokens: BeanstalkSDK['tokens']) {
    const { BEAN, ETH, WETH, WSTETH, WEETH, WBTC, USDC, USDT } = tokens;

    return [
      { token: WSTETH, minimum: new BigNumber(0.008) },
      { token: WETH, minimum: new BigNumber(0.01) },
      { token: ETH, minimum: new BigNumber(0.01) },
      { token: WEETH, minimum: new BigNumber(0.01) },
      { token: WBTC, minimum: new BigNumber(0.00005) },
      { token: BEAN, minimum: new BigNumber(1) },
      { token: USDC, minimum: new BigNumber(1) },
      { token: USDT, minimum: new BigNumber(1) },
    ];
  }

  private static validateTokenIn(
    sdkTokens: BeanstalkSDK['tokens'],
    tokenList: Token[],
    tokenIn: Token
  ) {
    if (!tokenList.find((token) => tokenIn.symbol === token.symbol)) {
      throw new Error('Invalid token');
    }

    return {
      beanIn: sdkTokens.BEAN.equals(tokenIn),
      ethIn: tokenIn.equals(sdkTokens.ETH),
      wethIn: sdkTokens.WETH.equals(tokenIn),
      wstETHIn: sdkTokens.WSTETH.equals(tokenIn),
    };
  }
}
