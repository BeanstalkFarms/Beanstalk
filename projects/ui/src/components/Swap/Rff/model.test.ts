import BigNumber from 'bignumber.js';

import type { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { BalanceMode } from '~/lib/Rff/request';
import {
  balanceForSource,
  balanceModeForSource,
  isRffChain,
  recipientForConnectedAccount,
  rffQuoteKey,
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

  it('keys a quote to its exact token and raw input amount', () => {
    expect(
      rffQuoteKey('0xBEA0005B8599265D41256905A9B3073D397812E4', 1_000_000n)
    ).toBe('0xbea0005b8599265d41256905a9b3073d397812e4:1000000');
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
});
