import { useCallback } from 'react';
import { REPLANTED_CHAINS } from '~/constants';
import useChainId from '../chain/useChainId';

export default function useMigrateCall() {
  const chainId = useChainId();
  return useCallback(
    // eslint-disable-next-line prefer-arrow-callback
    function migrate<T1, T2, T3 extends any = any>(
      contract: T1 | T2,
      opts: [
        (c: T1) => T3,
        (c: T2) => T3,
      ],
    ) {
      if (REPLANTED_CHAINS.has(chainId)) {
        return opts[1](contract as T2);
      }
      return opts[0](contract as T1);
    },
    [chainId]
  );
}
