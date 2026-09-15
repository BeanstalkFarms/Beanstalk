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
  const { beanstalk, beanstalkPrice } = sdk.contracts;
  const isBean = (token: ERC20Token) =>
    token.address.toLowerCase() === sdk.tokens.BEAN.address.toLowerCase();
  // BEAN has no external-token oracle. Use the same price source as Swap.
  const calls: AdvancedPipeStruct[] = tokens.map((token) => ({
    target: isBean(token) ? beanstalkPrice.address : beanstalk.address,
    callData: isBean(token)
      ? beanstalkPrice.interface.encodeFunctionData('price')
      : beanstalk.interface.encodeFunctionData('getTokenUsdPrice', [
          token.address,
        ]),
    clipboard: Clipboard.encode([]),
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const results = await Promise.race([
      beanstalk.callStatic.advancedPipe(calls, '0'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Price request timed out. Please try again.')),
          20_000
        );
      }),
    ]);
    return tokens.map((token, index) => {
      const value = isBean(token)
        ? beanstalkPrice.interface.decodeFunctionResult(
            'price',
            results[index]
          )[0].price
        : beanstalk.interface.decodeFunctionResult(
            'getTokenUsdPrice',
            results[index]
          )[0];
      const price = new BigNumber(value.toString()).shiftedBy(
        -ORACLE_PRICE_DECIMALS
      );
      if (!price.isFinite() || price.lte(0)) {
        throw new Error(
          `Price unavailable for ${token.symbol}. Please try again.`
        );
      }
      return price;
    });
  } finally {
    clearTimeout(timer);
  }
}
