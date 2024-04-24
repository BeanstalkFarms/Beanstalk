import { BeanstalkSDK } from '@beanstalk/sdk';
import { Token, TokenValue } from '@beanstalk/sdk-core';
import { ethers } from 'ethers';
import { FarmStep, EstimatesGas } from '~/lib/Txn/Interface';

export class MowFarmStep extends FarmStep implements EstimatesGas {
  _account: string;

  _tokensToMow: Map<Token, TokenValue>;

  constructor(
    _sdk: BeanstalkSDK,
    _account: string,
    _tokensToMow: Map<Token, TokenValue>
    // This step now calls mow or mowMultiple depending on how many tokens
    // are in _tokensToMow
  ) {
    super(_sdk);
    this._account = _account;
    this._tokensToMow = _tokensToMow;
  }

  async estimateGas(): Promise<ethers.BigNumber> {
    const { beanstalk } = this._sdk.contracts;
    const tokensToMow: string[] = [];
    this._tokensToMow.forEach((grown, token) => {
      if (grown.gt(0)) {
        tokensToMow.push(token.address);
      }
    });
    console.debug(`[MowFarmStep][estimateGas]: tokensToMow = `, tokensToMow);
    let gasAmount;
    if (tokensToMow.length === 1) {
      gasAmount = await beanstalk.estimateGas.mow(
        this._account,
        tokensToMow[0]
      );
    } else {
      gasAmount = await beanstalk.estimateGas.mowMultiple(
        this._account,
        tokensToMow
      );
    };
    console.debug(`[MowFarmStep][estimateGas]: `, gasAmount.toString());

    return gasAmount;
  }

  build() {
    this.clear();

    const { beanstalk } = this._sdk.contracts;
    const tokensToMow: string[] = [];
    this._tokensToMow.forEach((grown, token) => {
      if (grown.gt(0)) {
        tokensToMow.push(token.address);
      }
    });
    console.debug(`[MowFarmStep][build]: tokensToMow = `, tokensToMow);

    if (tokensToMow.length === 1) {
      this.pushInput({
        input: async (_amountInStep) => ({
          name: 'mow',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mow', [
              this._account,
              tokensToMow[0],
            ]),
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('mow', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('mow', result),
        }),
      });
    } else {
      this.pushInput({
        input: async (_amountInStep) => ({
          name: 'mowMultiple',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mowMultiple', [
              this._account,
              tokensToMow,
            ]),
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('mowMultiple', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('mowMultiple', result),
        }),
      });
    };

    console.debug('[MowFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
