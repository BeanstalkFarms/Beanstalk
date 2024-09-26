import { useMemo } from 'react';
import { Pool } from '@beanstalk/sdk';
import useSdk from '~/hooks/sdk';
import { arrayifyIfSet } from '~/util';

export type PoolMap = Record<string, Pool>;

export default function usePools() {
  const sdk = useSdk();
  return useMemo(() => {
    const pools = arrayifyIfSet(sdk.pools.pools);
    return pools.reduce<PoolMap>((acc, pool) => {
      acc[pool.address] = pool;
      return acc;
    }, {});
  }, [sdk]);
}
