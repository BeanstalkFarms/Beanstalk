import { vi } from 'vitest';
import { fetchInstantTokenUsdPrices } from './oracle';

const bean = { address: '0xBean', symbol: 'BEAN' };
const wsteth = { address: '0xWsteth', symbol: 'wstETH' };
function fixture(beanPrice = 250_000n, wstethPrice = 2_500_000_000n) {
  const advancedPipe = vi
    .fn()
    .mockResolvedValue(['bean-price', 'wsteth-price']);
  const sdk = {
    tokens: { BEAN: bean },
    contracts: {
      beanstalkPrice: {
        address: '0xPrice',
        interface: {
          encodeFunctionData: () => 'price()',
          decodeFunctionResult: () => [{ price: beanPrice }],
        },
      },
      beanstalk: {
        address: '0xBeanstalk',
        interface: {
          encodeFunctionData: (_name: string, [address]: [string]) =>
            `external:${address}`,
          // BEAN is not supported by the external-token oracle.
          decodeFunctionResult: (_name: string, result: string) => [
            result === 'bean-price' ? 0n : wstethPrice,
          ],
        },
        callStatic: { advancedPipe },
      },
    },
  };
  return { sdk, advancedPipe };
}

describe('RFF oracle prices', () => {
  it('uses BeanstalkPrice for BEAN and the external oracle for wstETH in one batch', async () => {
    const { sdk, advancedPipe } = fixture();
    const prices = await fetchInstantTokenUsdPrices(
      sdk as never,
      [bean, wsteth] as never
    );
    expect(prices.map((price) => price.toString())).toEqual(['0.25', '2500']);
    expect(advancedPipe).toHaveBeenCalledWith(
      [
        expect.objectContaining({ target: '0xPrice', callData: 'price()' }),
        expect.objectContaining({
          target: '0xBeanstalk',
          callData: 'external:0xWsteth',
        }),
      ],
      '0'
    );
  });

  it.each([
    [0n, 2_500_000_000n, 'BEAN'],
    [250_000n, 0n, 'wstETH'],
  ])(
    'rejects unavailable prices instead of returning a silent zero (%s, %s)',
    async (beanPrice, wstethPrice, symbol) => {
      const { sdk } = fixture(beanPrice as bigint, wstethPrice as bigint);
      await expect(
        fetchInstantTokenUsdPrices(sdk as never, [bean, wsteth] as never)
      ).rejects.toThrow(`Price unavailable for ${symbol}`);
    }
  );

  it('times out an unresponsive RPC so the UI can leave its loading state', async () => {
    vi.useFakeTimers();
    try {
      const { sdk, advancedPipe } = fixture();
      advancedPipe.mockReturnValue(new Promise(() => {}));
      const result = expect(
        fetchInstantTokenUsdPrices(sdk as never, [bean, wsteth] as never)
      ).rejects.toThrow('Price request timed out');
      vi.advanceTimersByTime(20_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
