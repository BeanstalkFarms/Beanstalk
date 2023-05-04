import { BeanstalkSDK } from '@beanstalk/sdk';
import { FarmInput } from '~/lib/Txn/types';
import { MayArray } from '~/types';

export default abstract class FarmStep {
  private _farmInput: FarmInput[];

  constructor(protected _sdk: BeanstalkSDK) {
    this._sdk = _sdk;
    this._farmInput = [];
  }

  pushInput(data: MayArray<FarmInput> | undefined) {
    if (!data) return;
    if (Array.isArray(data)) {
      this._farmInput.push(...data);
    } else {
      this._farmInput.push(data);
    }
  }

  getFarmInput() {
    return this._farmInput;
  }

  clear() {
    this._farmInput = [];
  }

  abstract build(...params: any[]): this;
}
