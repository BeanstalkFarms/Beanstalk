import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import Token from '~/classes/Token';
import { ZERO_BN } from '~/constants';
import { AppState } from '~/state';

/**
 * Return the BDV that Beanstalk will honor for a
 * given token when it is deposited in the Silo.
 */
export default function useBDV() {
  const beanstalkSiloBalances = useSelector<AppState, AppState['_beanstalk']['silo']['balances']>(
    (state) => state._beanstalk.silo.balances
  );
  return useCallback(
    (_token: Token) => beanstalkSiloBalances[_token.address]?.bdvPerToken || ZERO_BN,
    [beanstalkSiloBalances]
  );
}
