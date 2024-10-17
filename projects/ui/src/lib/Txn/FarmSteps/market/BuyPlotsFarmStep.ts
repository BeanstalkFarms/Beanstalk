import {
  BeanstalkSDK,
  BeanSwapOperation,
  ERC20Token,
  FarmFromMode,
  NativeToken,
  StepGenerator,
  TokenValue,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { PreferredToken } from '~/hooks/farmer/usePreferredToken';
import { FarmStep } from '~/lib/Txn/Interface';
import { BEAN, PODS } from '~/constants/tokens';
import { toStringBaseUnitBN } from '~/util';

export class BuyPlotsFarmStep extends FarmStep {
  constructor(
    _sdk: BeanstalkSDK,
    private _account: string
  ) {
    super(_sdk);
    this._account = _account;
  }

  build(
    tokenIn: ERC20Token | NativeToken,
    beanAmount: TokenValue,
    operation: BeanSwapOperation | undefined,
    pricePerPod: BigNumber,
    placeInLine: BigNumber
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    if (!this._sdk.tokens.BEAN.equals(tokenIn) && operation?.quote) {
      if (!this._sdk.tokens.BEAN.equals(operation.quote.buyToken)) {
        throw new Error(
          `Error building txn to buy plots. Expected buy token to be BEAN but got ${operation.quote.buyToken.symbol}`
        );
      }
      this.pushInput({
        input: [...operation.getFarm().generators] as StepGenerator[],
      });
    }

    const podOrder: StepGenerator = (_amountInStep) => ({
      name: 'createPodOrder',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('createPodOrder', [
          {
            orderer: this._account,
            fieldId: '0',
            pricePerPod: BEAN[1].stringify(pricePerPod),
            maxPlaceInLine: BEAN[1].stringify(placeInLine),
            minFillAmount: toStringBaseUnitBN(new BigNumber(1), PODS.decimals),
          },
          beanAmount.toBlockchain(),
          FarmFromMode.INTERNAL_TOLERANT,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionResult('createPodOrder', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('createPodOrder', result),
    });

    this.pushInput({ input: podOrder });

    console.debug('[BuyPodsFarmStep][build]', this.getFarmInput());

    return this;
  }

  static async getAmountOut(
    sdk: BeanstalkSDK,
    tokenIn: ERC20Token | NativeToken,
    amountIn: TokenValue,
    slippage: number
  ) {
    const quote = await sdk.beanSwap.quoter.route(
      tokenIn,
      sdk.tokens.BEAN,
      amountIn,
      slippage
    );

    console.debug(
      '[BuyPlotsFarmStep][getAmountOut]: estimate',
      quote.minBuyAmount.toHuman()
    );

    return {
      amountOut: quote.minBuyAmount,
      beanSwapQuote: quote,
    };
  }

  static getPreferredTokens(tokens: BeanstalkSDK['tokens']): {
    preferred: PreferredToken[];
    tokenList: (NativeToken | ERC20Token)[];
  } {
    const preferred: PreferredToken[] = [
      { token: tokens.BEAN, minimum: new BigNumber(1) }, // $1
      { token: tokens.ETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.WETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.WSTETH, minimum: new BigNumber(0.001) }, // $~2-4
      { token: tokens.WEETH, minimum: new BigNumber(0.001) }, // $~2-4
      { token: tokens.WBTC, minimum: new BigNumber(0.00005) }, // $~2-4
      { token: tokens.USDC, minimum: new BigNumber(1) }, // $1
      { token: tokens.USDT, minimum: new BigNumber(1) }, // $1
    ];

    const tokenList = preferred.map(
      ({ token }) => token as NativeToken | ERC20Token
    );

    return { preferred, tokenList };
  }
}
