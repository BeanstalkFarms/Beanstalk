import {
  BeanstalkSDK,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { SupportedChainId, BEAN_ETH_WELL_ADDRESSES } from '~/constants';
import { getChainConstant } from '~/util/Chain';

export class BuyFertilizerFarmStep extends FarmStep {
  private _tokenList: (ERC20Token | NativeToken)[];

  constructor(_sdk: BeanstalkSDK, private _account: string) {
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
    slippage: number
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const { wethIn } = BuyFertilizerFarmStep.validateTokenIn(
      this._sdk.tokens,
      this._tokenList,
      tokenIn
    );

    let fromMode = _fromMode;

    /// If the user is not using additional BEANs
    if (!wethIn) {
      this.pushInput({
        ...BuyFertilizerFarmStep.getSwap(
          this._sdk,
          tokenIn,
          this._sdk.tokens.WETH,
          this._account,
          fromMode
        ),
      });
      fromMode = FarmFromMode.INTERNAL_TOLERANT;
    }

    this.pushInput({
      input: async (_amountInStep) => {
        const amountWeth = this._sdk.tokens.WETH.fromBlockchain(_amountInStep);
        const amountFert = this.getFertFromWeth(amountWeth, ethPrice);
        const minLP = await this.calculateMinLP(amountWeth, ethPrice);

        return {
          name: 'mintFertilizer',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mintFertilizer', [
              amountWeth.toBlockchain(), // wethAmountIn
              amountFert.toBlockchain(), // minFertilizerOut
              minLP.subSlippage(slippage).toBlockchain(), // minLPTokensOut (with slippage applied)
              fromMode, // fromMode
            ]),
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('mintFertilizer', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('mintFertilizer', result),
        };
      },
    });

    this.pushInput(claimAndDoX.getTransferStep(this._account));

    console.debug('[BuyFertilizerFarmStep][build] steps', this.getFarmInput());

    return this;
  }

  // eslint-disable-next-line class-methods-use-this
  getFertFromWeth(amount: TokenValue, ethPrice: TokenValue) {
    return amount.mul(ethPrice).reDecimal(0);
  }

  // private methods

  /**
   *  The steps for calculating minLP given wethAmountIn are:
   * 1. usdAmountIn = wethAmountIn / wethUsdcPrice (or wethAmountIn * usdcWethPrice. Let's make sure to use  getMintFertilizerOut(1000000)
   *    or the function that I will add to make sure it uses the same wethUsdc price as the contract or otherwise the amount out could be off)
   * 2. beansMinted = usdAmountIn * 0.866616  (Because Beanstalk mints 0.866616 Beans for each $1 contributed)
   * 3. lpAmountOut = beanEthWell.getAddLiquidityOut([beansMinted, wethAmountIn])
   *
   * Apply slippage minLPTokensOut = lpAmountOut * (1 - slippage)
   */
  // eslint-disable-next-line class-methods-use-this
  private async calculateMinLP(
    wethAmount: TokenValue,
    ethPrice: TokenValue
  ): Promise<TokenValue> {
    const beanWethWellAddress = getChainConstant(
      BEAN_ETH_WELL_ADDRESSES,
      SupportedChainId.MAINNET
    ).toLowerCase();
    const well = await this._sdk.wells.getWell(beanWethWellAddress);

    const usdAmountIn = ethPrice.mul(wethAmount);
    const beansToMint = usdAmountIn.mul(0.866616);
    const lpEstimate = await well.addLiquidityQuote([beansToMint, wethAmount]);

    return lpEstimate;
  }

  private static getSwap(
    sdk: BeanstalkSDK,
    tokenIn: Token,
    tokenOut: Token,
    account: string,
    fromMode: FarmFromMode
  ) {
    const swap = sdk.swap.buildSwap(
      tokenIn,
      tokenOut,
      account,
      fromMode,
      FarmToMode.INTERNAL
    );

    return {
      swap,
      input: [...swap.getFarm().generators] as StepGenerator[],
    };
  }

  /// Static Methods

  public static async getAmountOut(
    sdk: BeanstalkSDK,
    tokenList: Token[],
    tokenIn: Token,
    amountIn: TokenValue,
    _fromMode: FarmFromMode,
    account: string
  ) {
    BuyFertilizerFarmStep.validateTokenIn(sdk.tokens, tokenList, tokenIn);

    const { swap, input } = BuyFertilizerFarmStep.getSwap(
      sdk,
      tokenIn,
      sdk.tokens.WETH,
      account,
      _fromMode
    );

    const estimate = await swap.estimate(amountIn);

    return {
      amountOut: estimate,
      input,
    };
  }

  public static getTokenList(tokens: BeanstalkSDK['tokens']) {
    return BuyFertilizerFarmStep.getPreferredTokens(tokens).map(
      ({ token }) => token
    );
  }

  public static getPreferredTokens(tokens: BeanstalkSDK['tokens']) {
    const { BEAN, ETH, WETH, CRV3, DAI, USDC, USDT } = tokens;

    return [
      { token: ETH, minimum: new BigNumber(0.01) },
      { token: WETH, minimum: new BigNumber(0.01) },
      { token: BEAN, minimum: new BigNumber(1) },
      { token: CRV3, minimum: new BigNumber(1) },
      { token: DAI, minimum: new BigNumber(1) },
      { token: USDC, minimum: new BigNumber(1) },
      { token: USDT, minimum: new BigNumber(1) },
    ];
  }

  private static validateTokenIn(
    sdkTokens: BeanstalkSDK['tokens'],
    tokenList: Token[],
    tokenIn: Token
  ) {
    if (!tokenList.find((token) => tokenIn.equals(token))) {
      throw new Error('Invalid token');
    }

    return {
      beanIn: sdkTokens.BEAN.equals(tokenIn),
      ethIn: tokenIn.equals(sdkTokens.ETH),
      wethIn: sdkTokens.WETH.equals(tokenIn),
    };
  }
}
