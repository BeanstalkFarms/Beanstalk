import { useCallback } from 'react';
import Token from '~/classes/Token';
import { ChainConstant } from '~/constants';
import { useGetChainConstant } from './useChainConstant';

/**
 * Returns a callback that accepts a `TokenOrTokenMap`.
 * If `t` is a Token      return the token.
 * If `t` is a TokenMap   extract the appropriate Token instance via `getChainConstant()`.
 * 
 * This is a helper function to avoid repeated use of `t instanceof Token ? ... : ...`.
 * 
 * @returns (t: Token | ChainConstant<Token>) => Token
 */
export default function useGetChainToken() {
  const getChainConstant = useGetChainConstant();
  return useCallback(
    // T = Token | ERC20Token | NativeToken ...
    <T extends Token>(t: T | ChainConstant<T>) : T => (
      (t instanceof Token) ? t : getChainConstant(t as ChainConstant<T>)
    ),
    [getChainConstant]
  );
}
