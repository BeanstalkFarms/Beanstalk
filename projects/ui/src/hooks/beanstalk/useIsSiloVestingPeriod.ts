import { useMemo } from 'react';
import { useAppSelector } from '~/state';

export const MAX_SILO_VESTING_BLOCKS = 10;

export default function useIsSiloVestingPeriod() {
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);

  const isVesting = useMemo(() => {
    if (morning.isMorning && morning.index.lte(MAX_SILO_VESTING_BLOCKS)) {
      return true;
    }

    return false;
  }, [morning.index, morning.isMorning]);

  return isVesting;
}
