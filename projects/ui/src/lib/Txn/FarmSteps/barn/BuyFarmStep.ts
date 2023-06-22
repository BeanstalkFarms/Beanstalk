import {
  BeanstalkSDK,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  FarmWorkflow,
  NativeToken,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { makeLocalOnlyStep } from '../../util';
import { tokenValueToBN } from '~/util';

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
    claimAndDoX: ClaimAndDoX
  ) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const { ethIn, usdcIn, beanIn } = BuyFertilizerFarmStep.validateTokenIn(
      this._sdk.tokens,
      this._tokenList,
      tokenIn
    );

    let fromMode = _fromMode;

    const additionalBean = claimAndDoX.claimedBeansUsed;

    /// If the user is not using additional BEANs
    if (!claimAndDoX.isUsingClaimed) {
      if (!usdcIn) {
        this.pushInput({
          ...BuyFertilizerFarmStep.getSwap(
            this._sdk,
            tokenIn,
            this._sdk.tokens.USDC,
            this._account,
            fromMode
          ),
        });
        fromMode = FarmFromMode.INTERNAL_TOLERANT;
      }
    }
    /// If the user is using additional BEANs & using either BEAN or ETH
    else if (!usdcIn) {
      if (ethIn) {
        this.pushInput({
          ...BuyFertilizerFarmStep.getSwap(
            this._sdk,
            tokenIn,
            this._sdk.tokens.BEAN,
            this._account,
            fromMode
          ),
        });
        fromMode = FarmFromMode.INTERNAL_TOLERANT;
      }
      this.pushInput(
        makeLocalOnlyStep({
          name: 'add-claimable-bean',
          amount: {
            additionalAmount: additionalBean,
          },
        })
      );
      if (beanIn) {
        /// FIXME: Edge case here. If the user has enough in their Internal to cover the full amount,
        /// & circulating balance is selected, it'll only use BEAN from their internal balance.
        if (fromMode === FarmFromMode.EXTERNAL) {
          fromMode = FarmFromMode.INTERNAL_EXTERNAL;
        }
      }
      this.pushInput({
        input: this.getBean2Usdc(fromMode),
      });
    }
    /// If the user is using additional BEANs & using USDC
    else if (usdcIn) {
      // forerun the buy fert txn w/ bean => USDC swap
      this.pushInput(
        makeLocalOnlyStep({
          name: 'add-claimable-bean',
          amount: {
            overrideAmount: additionalBean,
          },
        })
      );
      /// Internal Tolerant b/c we are claiming our claimable beans to our Internal balance.
      this.pushInput({
        input: this.getBean2Usdc(FarmFromMode.INTERNAL_TOLERANT),
      });
      // add the original amount of USDC in 'amountIn' w/ the amount out from claimable beans
      this.pushInput(
        makeLocalOnlyStep({
          name: 'add-original-USDC-amount',
          amount: {
            additionalAmount: amountIn,
          },
        })
      );
      if (fromMode === FarmFromMode.EXTERNAL) {
        fromMode = FarmFromMode.INTERNAL_EXTERNAL;
      }
    }

    this.pushInput({
      input: async (_amountInStep) => {
        const amountUSDC = this._sdk.tokens.USDC.fromBlockchain(_amountInStep);
        const roundedUSDCOut = this.roundDownUSDC(amountUSDC);
        const minLP = await this.calculateMinLP(
          this._sdk.tokens.USDC.fromBlockchain(roundedUSDCOut.blockchainString)
        );

        return {
          name: 'mintFertilizer',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mintFertilizer', [
              TokenValue.fromHuman(roundedUSDCOut.toHuman(), 0)
                .blockchainString,
              FarmWorkflow.slip(minLP, 0.1),
              fromMode,
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

  roundDownUSDC(amount: TokenValue) {
    const rounded = tokenValueToBN(amount).dp(0, BigNumber.ROUND_DOWN);
    return this._sdk.tokens.USDC.amount(rounded.toString());
  }

  // private methods
  private async calculateMinLP(roundedUSDCIn: TokenValue) {
    return this._sdk.contracts.curve.zap.callStatic.calc_token_amount(
      this._sdk.contracts.curve.pools.beanCrv3.address,
      [
        // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
        // delta B in the Bean:3Crv pool with A=1 equals the pre-export
        // total delta B times the haircut. Independent of the haircut %.
        roundedUSDCIn.mul(0.866616).blockchainString, // BEAN
        0, // DAI
        roundedUSDCIn.blockchainString, // USDC
        0, // USDT
      ],
      true, // _is_deposit
      { gasLimit: 10000000 }
    );
  }

  private getBean2Usdc(from: FarmFromMode) {
    return new this._sdk.farm.actions.ExchangeUnderlying(
      this._sdk.contracts.curve.pools.beanCrv3.address,
      this._sdk.tokens.BEAN,
      this._sdk.tokens.USDC,
      from,
      FarmToMode.INTERNAL
    );
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
      sdk.tokens.USDC,
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
      { token: BEAN, minimum: new BigNumber(1) },
      { token: ETH, minimum: new BigNumber(0.01) },
      { token: WETH, minimum: new BigNumber(0.01) },
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
      usdcIn: sdkTokens.USDC.equals(tokenIn),
    };
  }
}
