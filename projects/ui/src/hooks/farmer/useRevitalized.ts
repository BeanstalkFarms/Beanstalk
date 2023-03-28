import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { MaxBN } from '~/util';
import { BEAN_TO_STALK, BEAN_TO_SEEDS, ZERO_BN, LP_TO_SEEDS } from '~/constants';
import { UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import { AppState } from '~/state';
import useFarmerSiloBalances from './useFarmerSiloBalances';
import useGetChainToken from '../chain/useGetChainToken';

/**
 * Calculate the Farmer's current number of revitalized Stalk and Seeds.
 */
export default function useRevitalized() {
  /// Helpers
  const getChainToken = useGetChainToken();

  /// Balances
  const balances      = useFarmerSiloBalances();
  const beanstalkSilo = useSelector<AppState, AppState['_beanstalk']['silo']>((state) => state._beanstalk.silo);
  const currentSeason = useSelector<AppState, AppState['_beanstalk']['sun']['season']>((state) => state._beanstalk.sun.season);

  return useMemo(() => {
    const urBean      = getChainToken(UNRIPE_BEAN);
    const urBeanCrv3  = getChainToken(UNRIPE_BEAN_CRV3);
    const expectedBDV = (addr: string) => (balances[addr]?.deposited.amount || ZERO_BN).times(beanstalkSilo.balances[addr]?.bdvPerToken || ZERO_BN);
    const actualBDV   = (addr: string) => (balances[addr]?.deposited.bdv || ZERO_BN);
    const expectedGrownBDV = (addr: string) => (balances[addr]?.deposited.crates.reduce((ss, c) =>
      ss.plus(currentSeason.minus(c.season).times(c.amount.times(beanstalkSilo.balances[addr]?.bdvPerToken))), ZERO_BN) || ZERO_BN
    );
    const actualGrownBDV = (addr: string) => (balances[addr]?.deposited.crates.reduce((ss, c) => ss.plus(currentSeason.minus(c.season).times(c.bdv)), ZERO_BN) || ZERO_BN);

    // flooring at 0 prevents edge case where bdv < haircut during testing
    const delta1 = MaxBN(
      expectedBDV(urBean.address).minus(actualBDV(urBean.address)),
      ZERO_BN
    );
    const delta2 = MaxBN(
      expectedBDV(urBeanCrv3.address).minus(actualBDV(urBeanCrv3.address)),
      ZERO_BN
    );

    const deltaGrown1 = MaxBN(
      expectedGrownBDV(urBean.address).minus(actualGrownBDV(urBean.address)),
      ZERO_BN
    );
    const deltaGrown2 = MaxBN(
      expectedGrownBDV(urBeanCrv3.address).minus(actualGrownBDV(urBeanCrv3.address)),
      ZERO_BN
    );

    const seeds = delta1.times(BEAN_TO_SEEDS).plus(delta2.times(LP_TO_SEEDS));
    const stalk = delta1.plus(delta2).times(BEAN_TO_STALK).plus(
      deltaGrown1.times(BEAN_TO_SEEDS).div('10000')).plus(
      deltaGrown2.times(LP_TO_SEEDS).div('10000'));

    // console.debug('[useRevitalized] delta1 = ', `${delta1}`);
    // console.debug('[useRevitalized] delta2 = ', `${delta2}`);
    
    return {
      revitalizedStalk: stalk,
      revitalizedSeeds: seeds,
    };
  }, [
    balances,
    beanstalkSilo,
    currentSeason,
    getChainToken,
  ]);
}
