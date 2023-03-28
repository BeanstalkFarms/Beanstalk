import { useMemo } from 'react';
import Token from '~/classes/Token';
import { ChainConstant } from '~/constants';
import useGetChainToken from './useGetChainToken';

export default function useTokenList<T extends Token>(
  list: (T | ChainConstant<T>)[]
) {
  const getChainToken = useGetChainToken();
  return useMemo(
    () => list.map(getChainToken),
    [
      list,
      getChainToken,
    ]
  );
}
