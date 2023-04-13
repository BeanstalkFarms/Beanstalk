import { BeanstalkSDK, FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { FarmStepStrategy, EstimatesGas } from '~/lib/Txn/Strategy';

export class RinseStrategy extends FarmStepStrategy implements EstimatesGas {
  constructor(
    sdk: BeanstalkSDK,
    private _params: {
      tokenIds: string[];
      toMode?: FarmToMode;
    }
  ) {
    super(sdk);
    this._params = _params;
  }

  async estimateGas() {
    const { beanstalk } = RinseStrategy.sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.claimFertilized(
      this._params.tokenIds,
      this._params.toMode || FarmToMode.INTERNAL
    );
    console.debug(`[RinseStrategy][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  getSteps() {
    const { beanstalk } = RinseStrategy.sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'claimFertilized',
      amountOut: _amountInStep,
      prepare: () => ({
        contract: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
          this._params.tokenIds,
          this._params.toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('claimFertilized', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('claimFertilized', result),
    });

    const _steps = { steps: RinseStrategy.normaliseSteps(step) };
    console.debug('[RinseStrategy][getSteps]: ', _steps);

    return _steps;
  }
}
