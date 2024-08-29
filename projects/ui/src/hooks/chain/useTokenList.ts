import { useMemo } from 'react';
import LegacyToken from '~/classes/Token';
import { ChainConstant } from '~/constants';
import { Token } from '@beanstalk/sdk';
import { arrayifyIfSet } from '~/util';
import useGetChainToken from './useGetChainToken';

export default function useTokenList<T extends Token | LegacyToken>(
  list: (T | ChainConstant<T>)[] | Set<T>
): T[] {
  const getChainToken = useGetChainToken();
  return useMemo(
    () => arrayifyIfSet(list).map(getChainToken),
    [list, getChainToken]
  );
}
