import { BeanstalkSDK } from '@beanstalk/sdk';
import { Token } from '@beanstalk/sdk-core';
import { ethers } from 'ethers';
import { FarmStep, EstimatesGas } from '~/lib/Txn/Interface';

export class MowFarmStep extends FarmStep implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,
    private _account: string,

    // TODO(silo-v3): .update doesn't exist anymore.
    // Rewrite this mow step to use `mow()` or `mowMultiple()` depending on
    // the tokens requested to be mown. this will require ui changes or defaults
    private _token: Token
  ) {
    super(_sdk);
    this._account = _account;
    this._token = this._sdk.tokens.BEAN;
  }

  async estimateGas(): Promise<ethers.BigNumber> {
    const { beanstalk } = this._sdk.contracts;
    const gasAmount = await beanstalk.estimateGas.mow(
      this._account,
      this._token.address
    );
    console.debug(`[MowFarmStep][estimateGas]: `, gasAmount.toString());

    return gasAmount;
  }

  build() {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    this.pushInput({
      input: async (_amountInStep) => ({
        name: 'mow',
        amountOut: _amountInStep,
        prepare: () => ({
          target: beanstalk.address,
          callData: beanstalk.interface.encodeFunctionData('mow', [
            this._account,
            this._token.address,
          ]),
        }),
        decode: (data: string) =>
          beanstalk.interface.decodeFunctionData('mow', data),
        decodeResult: (result: string) =>
          beanstalk.interface.decodeFunctionResult('mow', result),
      }),
    });

    console.debug('[MowFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
