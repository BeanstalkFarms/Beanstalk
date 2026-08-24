import { vi } from 'vitest';

import { fetchInstantTokenUsdPrices } from './oracle';

describe('RFF oracle prices', () => {
  it('loads fresh token prices directly from the Beanstalk oracle', async () => {
    const encodeFunctionData = vi.fn(
      (_name: string, [address]: [string]) => `price:${address}`
    );
    const advancedPipe = vi.fn().mockResolvedValue([250_000n, 2_500_000_000n]);
    const sdk = {
      contracts: {
        beanstalk: {
          address: '0xBeanstalk',
          interface: {
            encodeFunctionData,
            decodeFunctionResult: (_name: string, result: bigint) => [result],
          },
          callStatic: { advancedPipe },
        },
      },
    };

    const prices = await fetchInstantTokenUsdPrices(
      sdk as never,
      [
        { address: '0xBean' },
        { address: '0xWsteth' },
      ] as never
    );

    expect(prices.map((price) => price.toString())).toEqual(['0.25', '2500']);
    expect(advancedPipe).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          target: '0xBeanstalk',
          callData: 'price:0xBean',
        }),
        expect.objectContaining({
          target: '0xBeanstalk',
          callData: 'price:0xWsteth',
        }),
      ],
      '0'
    );
  });
});
