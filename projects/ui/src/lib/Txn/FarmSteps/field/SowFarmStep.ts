import {
  BeanstalkSDK,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  StepGenerator,
  TokenValue,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { PreferredToken } from '~/hooks/farmer/usePreferredToken';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { makeLocalOnlyStep } from '../../util';

export class SowFarmStep extends FarmStep {
  constructor(_sdk: BeanstalkSDK, private _account: string) {
    super(_sdk);
    this._account = _account;
  }

  build(
    tokenIn: ERC20Token | NativeToken,
    _amountIn: TokenValue,
    _minTemperature: TokenValue,
    _minSoil: TokenValue,
    _fromMode: FarmFromMode,
    claimAndDoX: ClaimAndDoX
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;
    const { BEAN } = this._sdk.tokens;

    const usingBean = BEAN.equals(tokenIn);

    const addiitonalBean = claimAndDoX.claimedBeansUsed;

    let fromMode = _fromMode;

    if (!usingBean && _amountIn.gt(0)) {
      const swap = this._sdk.swap.buildSwap(
        tokenIn,
        BEAN,
        this._account,
        _fromMode,
        FarmToMode.INTERNAL
      );
      const swapSteps = [...swap.getFarm().generators] as StepGenerator[];
      this.pushInput({ input: swapSteps });
      fromMode = FarmFromMode.INTERNAL_TOLERANT;
    }

    if (addiitonalBean.gt(0)) {
      this.pushInput(
        makeLocalOnlyStep({
          name: 'claimable-pre-sow',
          amount: {
            additionalAmount: addiitonalBean,
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

  static async getAmountOut(
    sdk: BeanstalkSDK,
    tokenIn: ERC20Token | NativeToken,
    amountIn: TokenValue,
    fromMode: FarmFromMode,
    account: string
  ) {
    if (!account) {
      throw new Error('Signer Required');
    }

    const swap = sdk.swap.buildSwap(
      tokenIn,
      sdk.tokens.BEAN,
      account,
      fromMode,
      FarmToMode.INTERNAL
    );

    const estimate = await swap.estimate(amountIn);

    console.debug('[SowFarmStep][getAmountOut]: estimate', estimate.toHuman());

    return estimate;
  }

  /// estimate the maximum amount of tokenIn that can be deposited given the amount of soil
  static async getMaxForToken(
    sdk: BeanstalkSDK,
    tokenIn: ERC20Token | NativeToken,
    account: string,
    fromMode: FarmFromMode,
    soil: TokenValue
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

    const swap = sdk.swap.buildSwap(
      tokenIn,
      sdk.tokens.BEAN,
      account,
      fromMode,
      FarmToMode.INTERNAL
    );

    const estimate = await swap.estimateReversed(soil);
    console.debug(
      '[SowFarmStep][getMaxForToken]: estimate = ',
      estimate.toHuman(),
      tokenIn.symbol
    );
    return estimate;
  }

  static getPreferredTokens(tokens: BeanstalkSDK['tokens']): {
    preferred: PreferredToken[];
    tokenList: (NativeToken | ERC20Token)[];
  } {
    const preferred: PreferredToken[] = [
      { token: tokens.BEAN, minimum: new BigNumber(1) }, // $1
      { token: tokens.ETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.WETH, minimum: new BigNumber(0.001) }, // ~$2-4
      { token: tokens.CRV3, minimum: new BigNumber(1) }, // $1
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
