import BigNumber from 'bignumber.js';

import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { BalanceMode } from '~/lib/Rff/request';
import { balanceForSource, balanceModeForSource } from './model';

describe('RFF form model', () => {
  const balance = {
    internal: new BigNumber('12.5'),
    external: new BigNumber('8.25'),
    total: new BigNumber('20.75'),
  };

  it('uses only the exact balance selected by the user', () => {
    expect(balanceForSource(balance, BalanceFrom.EXTERNAL).toString()).toBe(
      '8.25'
    );
    expect(balanceForSource(balance, BalanceFrom.INTERNAL).toString()).toBe(
      '12.5'
    );
  });

  it('maps circulating and farm sources to the signed request mode', () => {
    expect(balanceModeForSource(BalanceFrom.EXTERNAL)).toBe(
      BalanceMode.EXTERNAL
    );
    expect(balanceModeForSource(BalanceFrom.INTERNAL)).toBe(
      BalanceMode.INTERNAL
    );
  });

  it('rejects Combined because RFF never mixes balance sources', () => {
    expect(() => balanceModeForSource(BalanceFrom.TOTAL)).toThrow(
      'RFF requires a single balance source'
    );
  });
});
