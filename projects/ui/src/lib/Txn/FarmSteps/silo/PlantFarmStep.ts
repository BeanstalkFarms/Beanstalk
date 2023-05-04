import { StepGenerator } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStep, EstimatesGas } from '~/lib/Txn/Interface';

export class PlantFarmStep extends FarmStep implements EstimatesGas {
  async estimateGas(): Promise<ethers.BigNumber> {
    const { beanstalk } = this._sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.plant();
    console.debug(`[PlantFarmStep][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  build() {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'plant',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('plant', undefined),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('plant', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('plant', result),
    });

    this.pushInput({ input: step });

    console.debug('[PlantFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
