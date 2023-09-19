import { BeanstalkSDK, FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { EstimatesGas, FarmStep } from '~/lib/Txn/Interface';

export class RinseFarmStep extends FarmStep implements EstimatesGas {
  constructor(
    sdk: BeanstalkSDK,
    private _fertilizerIds: string[],
    private _toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super(sdk);
    this._fertilizerIds = _fertilizerIds;
    this._toMode = _toMode;
  }

  async estimateGas() {
    const { beanstalk } = this._sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.claimFertilized(
      this._fertilizerIds,
      this._toMode
    );
    console.debug(`[RinseFarmStep][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  build() {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'claimFertilized',
      amountOut: _amountInStep,
      prepare: () => ({
        contract: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
          this._fertilizerIds,
          this._toMode,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('claimFertilized', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('claimFertilized', result),
    });

    this.pushInput({ input: step });
    console.debug('[RinseFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
