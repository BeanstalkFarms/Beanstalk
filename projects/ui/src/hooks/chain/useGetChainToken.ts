import { useCallback } from 'react';
import { Token } from '@beanstalk/sdk';
import TokenOld from '~/classes/Token';
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
    <T extends TokenOld | Token>(t: T | ChainConstant<T>): T => {
      if (t instanceof Token) return t;
      return t instanceof TokenOld
        ? t
        : getChainConstant(t as ChainConstant<T>);
    },
    [getChainConstant]
  );
}
