import {
  BeanstalkSDK,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  StepGenerator,
  Token,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { EstimatesGas, FarmStepStrategy } from '~/lib/Txn/Strategy';

export class ClaimStrategy extends FarmStepStrategy implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,
    protected _params: {
      tokenIn: Token;
      seasons: ethers.BigNumberish[];
      tokenOut?: Token;
      toMode?: FarmToMode;
    }
  ) {
    super(_sdk);
    this._params = _params;
  }

  async estimateGas() {
    const { beanstalk } = ClaimStrategy.sdk.contracts;
    let gasEstimate: ethers.BigNumber;

    if (this._params.seasons.length === 1) {
      gasEstimate = await beanstalk.estimateGas.claimWithdrawal(
        this._params.tokenIn.address,
        this._params.seasons[0],
        this._params.toMode || FarmToMode.INTERNAL
      );
    }
    gasEstimate = await beanstalk.estimateGas.claimWithdrawals(
      this._params.tokenIn.address,
      this._params.seasons,
      this._params.toMode || FarmToMode.INTERNAL
    );
    console.debug(`[ClaimStrategy][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  getSteps() {
    const sdk = ClaimStrategy.sdk;
    const steps: StepGenerator[] = [];

    const tokenIn = this._params.tokenIn as ERC20Token;
    const tokenOut = this._params.tokenOut as ERC20Token;

    const removeLiquidity = tokenIn.isLP && !tokenIn.equals(tokenOut);
    const pool = removeLiquidity
      ? sdk.pools.getPoolByLPToken(tokenIn)
      : undefined;

    const claimDestination = removeLiquidity
      ? FarmToMode.INTERNAL
      : this._params.toMode || FarmToMode.INTERNAL;

    if (this._params.seasons.length === 1) {
      steps.push(
        new sdk.farm.actions.ClaimWithdrawal(
          tokenIn.address,
          this._params.seasons[0],
          claimDestination
        )
      );
    } else {
      steps.push(
        new sdk.farm.actions.ClaimWithdrawals(
          tokenIn.address,
          this._params.seasons,
          claimDestination
        )
      );
    }

    if (removeLiquidity && pool) {
      steps.push(
        new sdk.farm.actions.RemoveLiquidityOneToken(
          pool.address,
          sdk.contracts.curve.registries.metaFactory.address,
          tokenOut.address,
          FarmFromMode.INTERNAL_TOLERANT,
          claimDestination
        )
      );
    }

    console.debug('[ClaimStrategy][getSteps]: ', steps);

    return {
      steps: ClaimStrategy.normaliseSteps(steps),
    };
  }
}
