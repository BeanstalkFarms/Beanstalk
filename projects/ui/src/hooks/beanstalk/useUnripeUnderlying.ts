import { useMemo } from 'react';
import { AddressMap } from '~/constants';
import useTokenList from '~/hooks/chain/useTokenList';
import { ERC20Token } from '@beanstalk/sdk';
import useSdk from '../sdk';

export default function useUnripeUnderlyingMap(
  keyedBy: 'unripe' | 'ripe' = 'unripe'
) {
  const sdk = useSdk();
  const unripe = useTokenList(sdk.tokens.unripeTokens as Set<ERC20Token>);
  const underlying = useTokenList(
    sdk.tokens.unripeUnderlyingTokens as Set<ERC20Token>
  );
  return useMemo(
    () =>
      unripe.reduce<AddressMap<ERC20Token>>((prev, unripeToken, index) => {
        if (keyedBy === 'unripe') prev[unripeToken.address] = underlying[index];
        // address => Ripe Token
        else prev[underlying[index].address] = unripeToken; // address => Unripe Token
        return prev;
      }, {}),
    [keyedBy, underlying, unripe]
  );
}
