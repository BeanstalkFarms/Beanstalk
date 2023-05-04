import { useMemo } from 'react';
import { Token } from '@beanstalk/sdk';
import TokenOld from '~/classes/Token';
import { ChainConstant, TokenMap } from '~/constants';
import useGetChainToken from './useGetChainToken';
import { getTokenIndex } from '~/util';


export default function useTokenMap<T extends Token | TokenOld>(
  list: (T | ChainConstant<T>)[]
) {
  const getChainToken = useGetChainToken();
  return useMemo(
    () => list.reduce<TokenMap<T>>(
      (acc, curr) => {
        // If this entry in the list is a Token and not a TokenMap, we
        // simply return the token. Otherwise we get the appropriate chain-
        // specific Token. This also dedupes tokens by address.
        const token = getChainToken(curr);
        if (token) acc[getTokenIndex(token)] = token;
        return acc;
      },
      {}
    ),
    [
      list,
      getChainToken,
    ]
  );
}
