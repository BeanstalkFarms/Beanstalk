import { FarmToMode, StepGenerator } from '@beanstalk/sdk';
import { FormTxn } from '~/util/formTxn';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

export default class ClaimWithdrawalsStep extends FormTxnAction<FormTxn.CLAIM> {
  implied = [];

  async estimateGas() {
    const { beanstalk } = this._sdk.contracts;

    const { token, seasons, toMode } = this.getParams();

    if (seasons.length === 1) {
      return beanstalk.estimateGas.claimWithdrawal(
        token,
        seasons[0],
        toMode || FarmToMode.INTERNAL
      );
    }

    return beanstalk.estimateGas.claimWithdrawals(
      token,
      seasons,
      toMode || FarmToMode.INTERNAL
    );
  }

  getSteps() {
    const { token, seasons, toMode } = this.getParams();
    const steps: StepGenerator[] = [];

    if (seasons.length === 1) {
      steps.push(
        new this._sdk.farm.actions.ClaimWithdrawal(
          token,
          seasons[0],
          toMode || FarmToMode.INTERNAL
        )
      );
    } else {
      steps.push(
        new this._sdk.farm.actions.ClaimWithdrawals(
          token,
          seasons,
          toMode || FarmToMode.INTERNAL
        )
      );
    }

    return steps;
  }
}
