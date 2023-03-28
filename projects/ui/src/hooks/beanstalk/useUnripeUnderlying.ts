import { useMemo } from 'react';
import { ERC20Token } from '~/classes/Token';
import { AddressMap } from '~/constants';
import { UNRIPE_TOKENS, UNRIPE_UNDERLYING_TOKENS } from '~/constants/tokens';
import useTokenList from '~/hooks/chain/useTokenList';

export default function useUnripeUnderlyingMap(
  keyedBy: 'unripe' | 'ripe' = 'unripe'
) {
  const unripe = useTokenList(UNRIPE_TOKENS);
  const underlying = useTokenList(UNRIPE_UNDERLYING_TOKENS);
  return useMemo(() => 
    unripe.reduce<AddressMap<ERC20Token>>((prev, unripeToken, index) => {
      if (keyedBy === 'unripe') prev[unripeToken.address] = underlying[index]; // address => Ripe Token
      else prev[underlying[index].address] = unripeToken;                      // address => Unripe Token
      return prev;
    }, {}),
    [keyedBy, underlying, unripe]
  );
}
