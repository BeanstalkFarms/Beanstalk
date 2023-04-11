import { BeanstalkSDK, StepGenerator } from '@beanstalk/sdk';
import { ethers } from 'ethers';

import { FormTxn, FormTxnParamsMap } from '~/util/formTxn';

export default abstract class FormTxnAction<T extends FormTxn> {
  protected _params: FormTxnParamsMap[T] | undefined;

  // implied actions that are called as a result of this action
  abstract implied: FormTxn[];

  constructor(protected _sdk: BeanstalkSDK) {
    this._sdk = _sdk;
  }

  setParams(params: FormTxnParamsMap[T]) {
    this._params = params;
    return this;
  }

  protected getParams(): FormTxnParamsMap[T] {
    if (!this._params) {
      throw new Error('Params not set for action');
    }
    return this._params;
  }

  abstract getSteps(): StepGenerator[];

  abstract estimateGas(): Promise<ethers.BigNumber>;
}
