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
import { BEAN, PODS } from '~/constants/tokens';
import { Bean } from '@beanstalk/sdk/dist/types/lib/bean';
import { ethers } from 'ethers';
import { toStringBaseUnitBN, tokenValueToBN } from '~/util';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
  
export class BuyPlotsFarmStep extends FarmStep {
    constructor(_sdk: BeanstalkSDK, private _account: string) {
      super(_sdk);
      this._account = _account;
    }
  
    build(
      tokenIn: ERC20Token | NativeToken,
      beanAmountOut: TokenValue,
      pricePerPod: BigNumber,
      placeInLine: BigNumber,
    ) {

    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const swap = this._sdk.swap.buildSwap(
        tokenIn,
        this._sdk.tokens.BEAN,
        this._account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL
    );

    const swapSteps = [...swap.getFarm().generators] as StepGenerator[]; 
    this.pushInput({ input: swapSteps });

    const podOrder: StepGenerator = (_amountInStep) => ({
    name: 'createPodOrder',
    amountOut: _amountInStep,
    prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('createPodOrder', [
            BEAN[1].stringify(tokenValueToBN(beanAmountOut)),
            BEAN[1].stringify(pricePerPod),
            BEAN[1].stringify(placeInLine),
            toStringBaseUnitBN(new BigNumber(1), PODS.decimals),
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
      amountIn: any,
      fromMode: FarmFromMode,
      account: any
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

      const estimate = await swap.estimate(ethers.BigNumber.from(toStringBaseUnitBN(amountIn, tokenIn.decimals)));
  
      console.debug('[BuyPlotsFarmStep][getAmountOut]: estimate', estimate.toHuman());
  
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
  