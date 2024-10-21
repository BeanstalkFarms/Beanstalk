import { useMemo } from 'react';
import { AddressMap } from '~/constants';
import useTokenList from '~/hooks/chain/useTokenList';
import { ERC20Token } from '@beanstalk/sdk';
import { BEAN, BEAN_WSTETH_WELL_LP } from '~/constants/tokens';
import useSdk from '../sdk';
import { useGetChainConstant } from '../chain/useChainConstant';
import { ERC20TokenInstance } from './useTokens';

export default function useUnripeUnderlyingMap(
  keyedBy: 'unripe' | 'ripe' = 'unripe'
) {
  const sdk = useSdk();
  const getChainConstant = useGetChainConstant();
  const unripe = useTokenList(sdk.tokens.unripeTokens as Set<ERC20Token>);
  const underlying = useTokenList([
    getChainConstant(BEAN),
    getChainConstant(BEAN_WSTETH_WELL_LP),
  ]);
  return useMemo(
    () =>
      unripe.reduce<AddressMap<ERC20TokenInstance>>(
        (prev, unripeToken, index) => {
          if (keyedBy === 'unripe')
            prev[unripeToken.address] = underlying[index];
          // address => Ripe Token
          else prev[underlying[index].address] = unripeToken; // address => Unripe Token
          return prev;
        },
        {}
      ),
    [keyedBy, underlying, unripe]
  );
}
