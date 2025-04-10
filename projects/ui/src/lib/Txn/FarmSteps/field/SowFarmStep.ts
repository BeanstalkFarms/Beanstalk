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
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { makeLocalOnlyStep } from '../../util';

export class SowFarmStep extends FarmStep {
  constructor(
    _sdk: BeanstalkSDK,
    private _account: string
  ) {
    super(_sdk);
    this._account = _account;
  }

  build(
    tokenIn: ERC20Token | NativeToken,
    amountIn: TokenValue,
    _minTemperature: TokenValue,
    _minSoil: TokenValue,
    _fromMode: FarmFromMode,
    operation: BeanSwapOperation | undefined,
    claimAndDoX: ClaimAndDoX
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;
    const { BEAN } = this._sdk.tokens;

    const usingBean = BEAN.equals(tokenIn);

    const addiitonalBean = claimAndDoX.claimedBeansUsed;

    let fromMode = _fromMode;

    if (!usingBean && operation) {
      this.pushInput({
        input: [...operation.getFarm().generators],
      });
      fromMode = FarmFromMode.INTERNAL_TOLERANT;
    }

    if (addiitonalBean.gt(0)) {
      this.pushInput(
        makeLocalOnlyStep({
          name: 'claimable-pre-sow',
          amount: {
            additionalAmount: !operation
              ? addiitonalBean.add(amountIn)
              : addiitonalBean,
          },
        })
      );
      if (fromMode === FarmFromMode.EXTERNAL) {
        fromMode = FarmFromMode.INTERNAL_EXTERNAL;
      }
    }

    const sow: StepGenerator = (_amountInStep) => ({
      name: 'sowWithMin',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('sowWithMin', [
          _amountInStep,
          _minTemperature.blockchainString,
          _minSoil.blockchainString,
          fromMode,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionResult('sowWithMin', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('sowWithMin', result),
    });

    this.pushInput({ input: sow });

    this.pushInput(claimAndDoX.getTransferStep(this._account));

    console.debug('[SowFarmStep][build]', this.getFarmInput());

    return this;
  }

  /// estimate the maximum amount of tokenIn that can be deposited given the amount of soil
  static async getMaxForToken(
    sdk: BeanstalkSDK,
    tokenIn: ERC20Token | NativeToken,
    soil: TokenValue,
    slippage: number
  ) {
    if (soil.lte(0)) {
      return tokenIn.amount('0');
    }

    if (sdk.tokens.BEAN.equals(tokenIn)) {
      console.debug(
        '[SowFarmStep][getMaxForToken]: estimate = ',
        soil.toHuman(),
        sdk.tokens.BEAN.symbol
      );
      return soil;
    }

    const quote = await sdk.beanSwap.quoter.route(
      sdk.tokens.BEAN,
      tokenIn,
      soil,
      slippage
    );

    console.debug(
      '[SowFarmStep][getMaxForToken]: estimate = ',
      quote.buyAmount.toHuman(),
      tokenIn.symbol
    );
    return quote.buyAmount;
  }

  static getPreferredTokens(tokens: BeanstalkSDK['tokens']): {
    preferred: PreferredToken[];
    tokenList: (NativeToken | ERC20Token)[];
  } {
    const preferred: PreferredToken[] = [
      { token: tokens.BEAN, minimum: new BigNumber(1) }, // $1
      { token: tokens.WSTETH, minimum: new BigNumber(0.00075) }, // ~$2-4
      { token: tokens.ETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.WETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.DAI, minimum: new BigNumber(1) }, // $1
      { token: tokens.USDC, minimum: new BigNumber(1) }, // $1
      { token: tokens.USDT, minimum: new BigNumber(1) }, // $1
    ];

    const tokenList = preferred.map(
      ({ token }) => token as NativeToken | ERC20Token
    );

    return { preferred, tokenList };
  }
}
