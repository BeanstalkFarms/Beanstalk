import {
  AdvancedPipeStruct,
  BeanstalkSDK,
  Clipboard,
  ERC20Token,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';

const ORACLE_PRICE_DECIMALS = 6;

export async function fetchInstantTokenUsdPrices(
  sdk: BeanstalkSDK,
  tokens: ERC20Token[]
): Promise<BigNumber[]> {
  const beanstalk = sdk.contracts.beanstalk;
  const calls: AdvancedPipeStruct[] = tokens.map((token) => ({
    target: beanstalk.address,
    callData: beanstalk.interface.encodeFunctionData('getTokenUsdPrice', [
      token.address,
    ]),
    clipboard: Clipboard.encode([]),
  }));
  const results = await beanstalk.callStatic.advancedPipe(calls, '0');

  return results.map((result) => {
    const value = beanstalk.interface.decodeFunctionResult(
      'getTokenUsdPrice',
      result
    )[0];
    return new BigNumber(value.toString()).shiftedBy(-ORACLE_PRICE_DECIMALS);
  });
}
