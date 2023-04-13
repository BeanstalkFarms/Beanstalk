import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStepStrategy } from '~/lib/Txn/Strategy';

export class TransferStrategy extends FarmStepStrategy {
  constructor(
    _sdk: BeanstalkSDK,
    private _params: {
      token: Token;
      toAddress: string;
      account: string;
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
        steps: TransferStrategy.normaliseSteps(
          new TransferStrategy.sdk.farm.actions.TransferDeposit(
            this._params.account,
            this._params.toAddress,
            this._params.token.address,
            this._params.seasons[0],
            this._params.amounts[0]
          )
        ),
      };
    }

    return {
      steps: TransferStrategy.normaliseSteps(
        new TransferStrategy.sdk.farm.actions.TransferDeposits(
          this._params.account,
          this._params.toAddress,
          this._params.token.address,
          this._params.seasons,
          this._params.amounts
        )
      ),
    };
  }
}
