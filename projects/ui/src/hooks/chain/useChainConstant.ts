import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ChainConstant, getChainConstant } from '~/util/Chain';

export function useGetChainConstant() {
  const { chain } = useAccount();
  return useCallback(
    <T extends ChainConstant>(map: T) => getChainConstant<T>(map, chain?.id),
    [chain?.id]
  );
}

export default function useChainConstant<T extends ChainConstant>(
  map: T
): T[keyof T] {
  const { chain } = useAccount();
  return getChainConstant<T>(map, chain?.id);
}
