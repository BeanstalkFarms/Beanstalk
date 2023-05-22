import { BeanstalkSDK, FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { EstimatesGas, FarmStep } from '~/lib/Txn/Interface';

export class HarvestFarmStep extends FarmStep implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,

    private _plotIds: string[]
  ) {
    super(_sdk);
    this._plotIds = _plotIds;
  }

  async estimateGas() {
    const { beanstalk } = this._sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.harvest(
      this._plotIds,
      FarmToMode.INTERNAL
    );
    console.debug(`[HarvestFarmStep][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  build(toMode: FarmToMode = FarmToMode.INTERNAL) {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'harvest',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('harvest', [
          this._plotIds,
          toMode,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('harvest', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('harvest', result),
    });

    this.pushInput({ input: step });
    console.debug('[HarvestFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
