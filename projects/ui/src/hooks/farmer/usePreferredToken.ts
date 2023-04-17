import { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import Token from '~/classes/Token';
import { ChainConstant } from '~/constants';
import useGetChainToken from '../chain/useGetChainToken';
import useFarmerBalances from './useFarmerBalances';

type TokenOrTokenMap = Token | ChainConstant<Token>;

export type PreferredToken = {
  token: TokenOrTokenMap;
  minimum?: BigNumber;
}

type FallbackMode = 'use-best';

/**
 * Select a single `Token` from a list of `PreferredToken[]` based on
 * the user's current balances and Token configuration.
 * 
 * Example: when instantiating the Sow form, we want the form to use
 * BEAN by default if the user has some minimum number of Beans in their
 * balance. Otherwise we move on to ETH, etc.
 * 
 * `list` should be ordered according to preference.
 * 
 * @param list An ordered list of Token to select from.
 * @param fallbackMode What to do if no Token meets the minimum amount requested.
 *    `use-best` Default to the first Token in the list.
 * @returns Token
 */
export default function usePreferredToken(
  list: PreferredToken[],
  fallbackMode : FallbackMode = 'use-best'
) {
  const getChainToken = useGetChainToken();
  const balances      = useFarmerBalances();
  return useMemo(() => {
    const index = list.findIndex((pt) => {
      const tok = getChainToken(pt.token);
      const min = pt.minimum || new BigNumber(tok.displayDecimals / 100); // default: 2 decimals => min 0.02
      const bal = balances[tok.address];
      return bal?.total?.gte(min) || false;
    });
    // console.debug(`[hooks/usePreferredToken] found a preferred token: ${index}`);
    if (index > -1) return getChainToken(list[index].token);
    switch (fallbackMode) {
      default:
      case 'use-best':
        return getChainToken(list[0].token);
    }
  }, [
    list,
    getChainToken,
    balances,
    fallbackMode
  ]);
}
