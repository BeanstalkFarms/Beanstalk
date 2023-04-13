import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStepStrategy } from '~/lib/Txn/Strategy';

export class WithdrawStrategy extends FarmStepStrategy {
  constructor(
    _sdk: BeanstalkSDK,
    private _params: {
      /// whitelisted token
      target: Token;
      seasons: ethers.BigNumberish[];
      amounts: ethers.BigNumberish[];
    }
  ) {
    super(_sdk);
    this._params = _params;
  }

  getSteps() {
    if (this._params.seasons.length === 0) {
      throw new Error('Malformatted crates');
    } else if (this._params.seasons.length === 1) {
      return {
        steps: WithdrawStrategy.normaliseSteps(
          new WithdrawStrategy.sdk.farm.actions.WithdrawDeposit(
            this._params.target.address,
            this._params.seasons[0],
            this._params.amounts[0]
          )
        ),
      };
    }

    return {
      steps: WithdrawStrategy.normaliseSteps(
        new WithdrawStrategy.sdk.farm.actions.WithdrawDeposits(
          this._params.target.address,
          this._params.seasons,
          this._params.amounts
        )
      ),
    };
  }
}
