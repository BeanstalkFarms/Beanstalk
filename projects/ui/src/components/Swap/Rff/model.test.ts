import BigNumber from 'bignumber.js';

import type { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { BalanceMode } from '~/lib/Rff/request';
import {
  balanceForSource,
  balanceModeForSource,
  isRffChain,
  isRffOracleQuoteFresh,
  oracleAmountOut,
  recipientForConnectedAccount,
} from './model';

describe('RFF form model', () => {
  const external = 'external' as BalanceFrom;
  const internal = 'internal' as BalanceFrom;
  const combined = 'total' as BalanceFrom;
  const balance = {
    internal: new BigNumber('12.5'),
    external: new BigNumber('8.25'),
    total: new BigNumber('20.75'),
  };

  it('uses only the exact balance selected by the user', () => {
    expect(balanceForSource(balance, external).toString()).toBe(
      '8.25'
    );
    expect(balanceForSource(balance, internal).toString()).toBe(
      '12.5'
    );
  });

  it('maps circulating and farm sources to the signed request mode', () => {
    expect(balanceModeForSource(external)).toBe(
      BalanceMode.EXTERNAL
    );
    expect(balanceModeForSource(internal)).toBe(
      BalanceMode.INTERNAL
    );
  });

  it('rejects Combined because RFF never mixes balance sources', () => {
    expect(() => balanceModeForSource(combined)).toThrow(
      'RFF requires a single balance source'
    );
  });

  it('quotes Bean to wstETH from the existing USD oracle prices', () => {
    expect(
      oracleAmountOut({
        amountIn: 1_000_000_000n,
        tokenInDecimals: 6,
        tokenOutDecimals: 18,
        tokenInUsd: new BigNumber('0.25'),
        tokenOutUsd: new BigNumber('2500'),
      })
    ).toBe(100_000_000_000_000_000n);
  });

  it('quotes wstETH to Bean from the existing USD oracle prices', () => {
    expect(
      oracleAmountOut({
        amountIn: 100_000_000_000_000_000n,
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        tokenInUsd: new BigNumber('2500'),
        tokenOutUsd: new BigNumber('0.25'),
      })
    ).toBe(1_000_000_000n);
  });

  it('does not quote until both oracle prices are usable', () => {
    expect(
      oracleAmountOut({
        amountIn: 1_000_000n,
        tokenInDecimals: 6,
        tokenOutDecimals: 18,
        tokenInUsd: new BigNumber(0),
        tokenOutUsd: new BigNumber('2500'),
      })
    ).toBe(0n);
  });

  it('resets the default recipient when the connected wallet changes', () => {
    expect(
      recipientForConnectedAccount(
        '0x2222222222222222222222222222222222222222'
      )
    ).toBe('0x2222222222222222222222222222222222222222');
    expect(recipientForConnectedAccount(undefined)).toBe('');
  });

  it('only permits the configured Arbitrum chain', () => {
    expect(isRffChain(42_161, 42_161)).toBe(true);
    expect(isRffChain(1, 42_161)).toBe(false);
    expect(isRffChain(undefined, 42_161)).toBe(false);
  });

  it('rejects oracle quotes older than two minutes', () => {
    const now = 1_000_000;

    expect(isRffOracleQuoteFresh(now - 119_999, now)).toBe(true);
    expect(isRffOracleQuoteFresh(now - 120_001, now)).toBe(false);
    expect(isRffOracleQuoteFresh(undefined, now)).toBe(false);
  });
});
