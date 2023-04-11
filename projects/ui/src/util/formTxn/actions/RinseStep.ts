import { FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { FormTxn } from '~/util/FormTxns';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

export default class RinseStep extends FormTxnAction<FormTxn.RINSE> {
  implied = [];

  async estimateGas() {
    const { beanstalk } = this._sdk.contracts;
    const params = this.getParams();
    return beanstalk.estimateGas.claimFertilized(
      params.tokenIds,
      params.toMode || FarmToMode.INTERNAL
    );
  }

  getSteps() {
    const { beanstalk } = this._sdk.contracts;
    const params = this.getParams();

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'claimFertilized',
      amountOut: _amountInStep,
      prepare: () => ({
        contract: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
          params.tokenIds,
          params.toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('claimFertilized', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('claimFertilized', result),
    });

    return [step];
  }
}
