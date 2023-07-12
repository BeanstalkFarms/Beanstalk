import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';

export const MAX_SILO_VESTING_BLOCKS = new BigNumber(10);

export default function useFarmerSiloVesting() {
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);

  /// TODO: Fix me with the new earned beans amount
  const earnedBeans = useAppSelector((s) => s._farmer.silo.beans.earned);

  return useMemo(() => {
    const isVesting = morning.isMorning && morning.index.lte(10);

    const remainingBlocks = isVesting
      ? MAX_SILO_VESTING_BLOCKS.minus(morning.index).plus(1)
      : ZERO_BN;

    return {
      amount: earnedBeans,
      isVesting,
      remainingBlocks,
    };
  }, [earnedBeans, morning.index, morning.isMorning]);
}
