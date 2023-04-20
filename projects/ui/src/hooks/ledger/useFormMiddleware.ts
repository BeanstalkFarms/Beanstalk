import { useMemo } from 'react';
import { SupportedChainId } from '~/constants';
import useChainId from '~/hooks/chain/useChainId';

export default function useFormMiddleware() {
  const chainId = useChainId();
  return useMemo(() => ({
    before: () => {
      if (!SupportedChainId[chainId]) {
        throw new Error(`Chain ID ${chainId} is not supported`);
      }
    },
    // after: () => {}
  }), [chainId]);
}
