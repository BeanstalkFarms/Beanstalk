import { BeanstalkSDK, StepGenerator } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStepStrategy, EstimatesGas } from '~/lib/Txn/Strategy';

export class MowStrategy extends FarmStepStrategy implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,
    private _params: {
      account: string;
    }
  ) {
    super(_sdk);
    this._params = _params;
  }

  async estimateGas(): Promise<ethers.BigNumber> {
    const { beanstalk } = MowStrategy.sdk.contracts;
    const gasAmount = await beanstalk.estimateGas.update(this._params.account);
    console.debug(`[MowStrategy][estimateGas]: `, gasAmount.toString());

    return gasAmount;
  }

  getSteps() {
    const { beanstalk } = MowStrategy.sdk.contracts;

    const steps: StepGenerator = async (_amountInStep) => ({
      name: 'update',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('update', [
          this._params.account,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('update', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('update', result),
    });

    const _steps = { steps: MowStrategy.normaliseSteps(steps) };
    console.debug('[MowStrategy][getSteps]: ', _steps);

    return _steps;
  }
}
