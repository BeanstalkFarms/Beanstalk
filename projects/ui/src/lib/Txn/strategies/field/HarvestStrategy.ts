import { BeanstalkSDK, FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { FarmStepStrategy, EstimatesGas } from '~/lib/Txn/Strategy';

export class HarvestStrategy extends FarmStepStrategy implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,
    private _params: {
      plotIds: string[];
      toMode?: FarmToMode;
    }
  ) {
    super(_sdk);
    this._params = _params;
  }

  async estimateGas() {
    const { beanstalk } = HarvestStrategy.sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.harvest(
      this._params.plotIds,
      this._params.toMode || FarmToMode.INTERNAL
    );
    console.debug(`[HarvestStrategy][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  getSteps() {
    const { beanstalk } = HarvestStrategy.sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'harvest',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('harvest', [
          this._params.plotIds,
          this._params.toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('harvest', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('harvest', result),
    });

    const _steps = { steps: HarvestStrategy.normaliseSteps(step) };
    console.debug('[HarvestStrategy][getSteps]: ', _steps);

    return _steps;
  }
}
