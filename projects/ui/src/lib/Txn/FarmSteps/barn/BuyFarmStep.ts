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
        const minLP = await this.calculateMinLP(amountWeth);

        return {
          name: 'mintFertilizer',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mintFertilizer', [
              amountWeth.toBlockchain(), // wethAmountIn
              amountFert.toBlockchain(), // minFertilizerOut
              minLP.addSlippage(slippage).toBlockchain(), // minLPTokensOut (apply slippage here)
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
  // eslint-disable-next-line class-methods-use-this
  private async calculateMinLP(wethAmount: TokenValue): Promise<TokenValue> {
    // return this._sdk.contracts.curve.zap.callStatic.calc_token_amount(
    //   this._sdk.contracts.curve.pools.beanCrv3.address,
    //   [
    //     // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
    //     // delta B in the Bean:3Crv pool with A=1 equals the pre-export
    //     // total delta B times the haircut. Independent of the haircut %.
    //     roundedUSDCIn.mul(0.866616).blockchainString, // BEAN
    //     0, // DAI
    //     roundedUSDCIn.blockchainString, // USDC
    //     0, // USDT
    //   ],
    //   true, // _is_deposit
    //   { gasLimit: 10000000 }
    // );

    return TokenValue.ZERO;
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
