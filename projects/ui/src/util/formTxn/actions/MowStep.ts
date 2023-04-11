import { StepGenerator } from '@beanstalk/sdk';

import { FormTxn } from '~/util/formTxn';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

export default class MowStep extends FormTxnAction<FormTxn.MOW> {
  implied = [];

  async estimateGas() {
    const params = this.getParams();
    return this._sdk.contracts.beanstalk.estimateGas.update(params.account);
  }

  getSteps() {
    const { beanstalk } = this._sdk.contracts;
    const params = this.getParams();
    const step: StepGenerator = async (_amountInStep) => ({
      name: 'update',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('update', [
          params.account,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('update', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('update', result),
    });

    return [step];
  }
}
