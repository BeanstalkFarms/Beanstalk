import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { FarmStepStrategy } from '~/lib/Txn/Strategy';

type ConvertParams = {
  /// whitelisted token
  target: Token;
  account: string;
};

export class ConvertStrategy extends FarmStepStrategy {
  constructor(_sdk: BeanstalkSDK, private _params: ConvertParams) {
    super(_sdk);
    this._params = _params;
  }

  static handleConversion(
    sdk: BeanstalkSDK,
    _tokenIn: Token,
    _amountIn: string,
    _tokenOut: Token,
    slippage: number,
    isConvertingPlanted: boolean
  ) {}

  // eslint-disable-next-line class-methods-use-this
  getSteps() {
    const { silo } = ConvertStrategy.sdk;

    return [];
  }
}
