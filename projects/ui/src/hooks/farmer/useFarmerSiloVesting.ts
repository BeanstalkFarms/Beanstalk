import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';

export const MAX_SILO_VESTING_BLOCKS = new BigNumber(10);

export default function useFarmerSiloVesting() {
  /// App State
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const farmerSilo = useAppSelector((s) => s._farmer.silo);
  const silo = useAppSelector((s) => s._beanstalk.silo);

  return useMemo(() => {
    const isVesting =
      morning.isMorning && morning.index.lte(MAX_SILO_VESTING_BLOCKS);

    const remainingBlocks = isVesting
      ? MAX_SILO_VESTING_BLOCKS.minus(morning.index).plus(1)
      : ZERO_BN;

    const totalStalkPrevSeason = silo.stalk.totalPrevSeason;
    const farmerStalkPrevSeason = farmerSilo.stalk.totalPrevSeason;

    const totalEarnedBeans = silo.beans.earned;
    const totalEarnedBeansPrevSeason = silo.beans.earnedPrevSeason;

    const deltaEarnedBeans = totalEarnedBeans.minus(totalEarnedBeansPrevSeason);

    const farmerPrevSeasonStalkPct =
      farmerStalkPrevSeason.div(totalStalkPrevSeason);

    const earnedBeansThisSeason = deltaEarnedBeans.times(
      farmerPrevSeasonStalkPct
    );

    return {
      amount: earnedBeansThisSeason,
      isVesting,
      remainingBlocks,
    };
  }, [
    silo.stalk.totalPrevSeason,
    farmerSilo.stalk.totalPrevSeason,
    morning.index,
    morning.isMorning,
    silo.beans.earned,
    silo.beans.earnedPrevSeason,
  ]);
}
