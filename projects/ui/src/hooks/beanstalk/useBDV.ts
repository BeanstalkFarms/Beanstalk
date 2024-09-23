import { useCallback } from 'react';
import { ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import { TokenInstance } from './useTokens';

/**
 * Return the BDV that Beanstalk will honor for a
 * given token when it is deposited in the Silo.
 */
export default function useBDV() {
  const beanstalkSiloBalances = useAppSelector(
    (state) => state._beanstalk.silo.balances
  );
  return useCallback(
    (_token: TokenInstance) =>
      beanstalkSiloBalances[_token.address]?.bdvPerToken || ZERO_BN,
    [beanstalkSiloBalances]
  );
}
