import { useMemo } from 'react';
import { ERC20Token, NativeToken } from '@beanstalk/sdk';
import TokenOld from '~/classes/Token';
import { ChainConstant, TokenMap } from '~/constants';
import { getTokenIndex } from '~/util';
import useGetChainToken from './useGetChainToken';

export type IndexableToken = ERC20Token | NativeToken;

export default function useTokenMap<T extends IndexableToken | TokenOld>(
  list: (T | ChainConstant<T>)[] | Set<T>
) {
  const getChainToken = useGetChainToken();
  return useMemo(
    () =>
      [...list].reduce<TokenMap<T>>((acc, curr) => {
        // If this entry in the list is a Token and not a TokenMap, we
        // simply return the token. Otherwise we get the appropriate chain-
        // specific Token. This also dedupes tokens by address.
        const token = getChainToken(curr);
        if (token) acc[getTokenIndex(token)] = token;
        return acc;
      }, {}),
    [list, getChainToken]
  );
}
