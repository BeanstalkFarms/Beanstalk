import { useMemo } from 'react';
import { Token } from '@beanstalk/sdk';
import TokenOld from '~/classes/Token';
import { ChainConstant, TokenMap } from '~/constants';
import useGetChainToken from './useGetChainToken';

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
        // in the sdk, address of ETH is "". We need to use "eth" as key
        const key = token instanceof Token && token.symbol === 'ETH' ? 'eth' : token.address;
        if (token) acc[key] = token;
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
