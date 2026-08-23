import { describe, expect, it } from 'vitest';

import {
  BalanceMode,
  BEAN_ADDRESS,
  WSTETH_ADDRESS,
  buildCancelRffSwapTypedData,
  buildRffSwapRequestTypedData,
  deadlineOneMonthFrom,
  minimumAmountOut,
} from './request';

describe('RFF request schema', () => {
  it('matches the service schema-v1 golden request digest', () => {
    const typedData = buildRffSwapRequestTypedData(
      {
        requester: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x2222222222222222222222222222222222222222',
        tokenIn: BEAN_ADDRESS,
        tokenOut: WSTETH_ADDRESS,
        requestedAmountIn: 1_000_000n,
        minAmountOutAtRequestedIn: 300_000_000_000_000n,
        sourceMode: BalanceMode.EXTERNAL,
        destinationMode: BalanceMode.INTERNAL,
        nonce: 12_345n,
        deadline: 2_000_000_000n,
      },
      '0x1111111111111111111111111111111111111111'
    );

    expect(typedData.digest).toBe(
      '0xf4407ae307bc07d1f2ae1bcdd562c29366041352dac7654c5ccbb591b1476b23'
    );
  });

  it('rounds the slippage-protected minimum down in integer token units', () => {
    expect(minimumAmountOut(123_456_789n, 100)).toBe(122_222_221n);
    expect(minimumAmountOut(1n, 100)).toBe(0n);
  });

  it('defaults expiration to exactly 30 days from the current second', () => {
    expect(deadlineOneMonthFrom(1_700_000_000)).toBe(1_702_592_000n);
  });

  it('matches the service cancellation digest', () => {
    const typedData = buildCancelRffSwapTypedData(
      {
        requestId:
          '0xf4407ae307bc07d1f2ae1bcdd562c29366041352dac7654c5ccbb591b1476b23',
        deadline: 2_000_000_300n,
      },
      '0x1111111111111111111111111111111111111111'
    );

    expect(typedData.digest).toBe(
      '0x0e860c7e66ec57e07c5f421fa4ccfb364a1d23a6506cd60f6ee1ae70aada5444'
    );
  });
});
