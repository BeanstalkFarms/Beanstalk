import { FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { FormTxn } from '~/util/formTxn';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

export default class HarvestStep extends FormTxnAction<FormTxn.HARVEST> {
  implied = [];

  async estimateGas() {
    const params = this.getParams();
    return this._sdk.contracts.beanstalk.estimateGas.harvest(
      params.plotIds,
      params.toMode || FarmToMode.INTERNAL
    );
  }

  getSteps() {
    const { beanstalk } = this._sdk.contracts;
    const params = this.getParams();

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'harvest',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('harvest', [
          params.plotIds,
          params.toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('harvest', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('harvest', result),
    });

    return [step];
  }
}
