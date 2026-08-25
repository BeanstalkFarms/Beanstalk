import { BeanstalkSDK, Deposit, Token, TokenValue } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import { ConvertFarmStep } from './ConvertFarmStep';

const makeToken = (address: string) =>
  ({
    address,
    amount: (value: string | number) => TokenValue.fromHuman(value, 6),
    equals: (other: Token) =>
      address.toLowerCase() === other.address.toLowerCase(),
    fromBlockchain: (value: string | number | ethers.BigNumber) =>
      TokenValue.fromBlockchain(value, 6),
  }) as unknown as Token;

describe('ConvertFarmStep', () => {
  it('quotes urLP to urBEAN from the convert result instead of getAmountOut', async () => {
    const tokenIn = makeToken('0x0000000000000000000000000000000000000001');
    const tokenOut = makeToken('0x0000000000000000000000000000000000000002');
    const amountIn = tokenIn.amount(1);
    const quotedAmountOut = tokenOut.amount('2.4');
    const crate = {
      stem: ethers.BigNumber.from(123),
      amount: amountIn,
    } as unknown as Deposit;

    const calculateConvert = vi.fn().mockReturnValue({
      amount: amountIn,
      crates: [crate],
    });
    const calculateEncoding = vi.fn().mockReturnValue('0xquote');
    const getAmountOut = vi
      .fn()
      .mockRejectedValue(new Error('stale EBIP-23 getter'));
    const convert = vi.fn().mockResolvedValue({
      toAmount: quotedAmountOut.toBlockchain(),
    });
    const encodeFunctionData = vi.fn().mockReturnValue('0xfinal');

    const sdk = {
      contracts: {
        beanstalk: {
          callStatic: { convert },
          getAmountOut,
          interface: { encodeFunctionData },
        },
      },
      silo: {
        siloConvert: {
          calculateConvert,
          calculateEncoding,
        },
      },
      tokens: {
        UNRIPE_BEAN_WSTETH: tokenIn,
        UNRIPE_BEAN: tokenOut,
      },
    } as unknown as BeanstalkSDK;

    const result = await ConvertFarmStep._handleConversion(
      sdk,
      [crate],
      tokenIn,
      tokenOut,
      amountIn,
      1,
      1
    );

    expect(result.minAmountOut.toHuman()).toBe('2.376');
    expect(convert).toHaveBeenCalledWith('0xquote', ['123'], ['1000000']);
    expect(getAmountOut).not.toHaveBeenCalled();

    const quoteMinimum = calculateEncoding.mock.calls[0][3] as TokenValue;
    expect(quoteMinimum.toBlockchain()).toBe('0');

    expect(result.getEncoded()).toBe('0xfinal');
    const executionMinimum = calculateEncoding.mock.calls[1][3] as TokenValue;
    expect(executionMinimum.toBlockchain()).toBe('2376000');
    expect(encodeFunctionData).toHaveBeenCalledWith('convert', [
      '0xquote',
      ['123'],
      ['1000000'],
    ]);
  });

  it('continues to quote other convert routes with getAmountOut', async () => {
    const unripeLp = makeToken('0x0000000000000000000000000000000000000001');
    const unripeBean = makeToken('0x0000000000000000000000000000000000000002');
    const tokenIn = makeToken('0x0000000000000000000000000000000000000003');
    const tokenOut = makeToken('0x0000000000000000000000000000000000000004');
    const amountIn = tokenIn.amount(1);
    const quotedAmountOut = tokenOut.amount('2.4');
    const crate = {
      stem: ethers.BigNumber.from(123),
      amount: amountIn,
    } as unknown as Deposit;

    const getAmountOut = vi
      .fn()
      .mockResolvedValue(quotedAmountOut.toBlockchain());
    const convert = vi.fn();
    const sdk = {
      contracts: {
        beanstalk: {
          callStatic: { convert },
          getAmountOut,
        },
      },
      silo: {
        siloConvert: {
          calculateConvert: vi.fn().mockReturnValue({
            amount: amountIn,
            crates: [crate],
          }),
        },
      },
      tokens: {
        UNRIPE_BEAN_WSTETH: unripeLp,
        UNRIPE_BEAN: unripeBean,
      },
    } as unknown as BeanstalkSDK;

    const result = await ConvertFarmStep._handleConversion(
      sdk,
      [crate],
      tokenIn,
      tokenOut,
      amountIn,
      1,
      1
    );

    expect(result.minAmountOut.toHuman()).toBe('2.376');
    expect(getAmountOut).toHaveBeenCalledWith(
      tokenIn.address,
      tokenOut.address,
      '1000000'
    );
    expect(convert).not.toHaveBeenCalled();
  });
});
