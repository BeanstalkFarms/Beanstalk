import { ZERO_BN } from '~/constants';
import useSeason from '~/hooks/beanstalk/useSeason';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';

/**
 * @note unused as of 10/21/2022.
 */
export default function useFarmerStalkSources() {
  const balances = useFarmerSiloBalances();
  const season = useSeason();
  
  return Object.keys(balances).reduce((prev, curr) => {
    const crates = balances[curr].deposited.crates;
    if (!season) return prev;
    crates.forEach((crate) => {
      const elapsedSeasons = season.minus(crate.season);
      prev.base  = prev.base.plus(crate.stalk);
      prev.grown = prev.grown.plus(
        crate.seeds.times(elapsedSeasons).times(0.0001) // FIXME: make this a constant or helper function
      );
    });
    return prev;
  }, {
    base:  ZERO_BN,
    grown: ZERO_BN,
  });
}
