import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { TokenMap, ZERO_BN } from '~/constants';
import useSeason from '~/hooks/beanstalk/useSeason';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';
import { STALK_PER_SEED_PER_SEASON } from '~/util';

type BaseToGrownStalk = {
  base: BigNumber;
  grown: BigNumber;
  seeds: BigNumber;
  unclaimed: BigNumber;
};

export default function useFarmerStalkByToken() {
  const balances = useFarmerSiloBalances();
  const season = useSeason();

  return useMemo(
    () =>
      Object.entries(balances).reduce<TokenMap<BaseToGrownStalk>>(
        (prev, [tokenAddress, tokenBalances]) => {
          if (!season) return prev;
          prev[tokenAddress] =
            tokenBalances.deposited.crates.reduce<BaseToGrownStalk>(
              (acc, crate) => {
                const elapsedSeasons = season.minus(crate.season);
                const seasonsSinceUpdate = season.minus(
                  tokenBalances.lastUpdate
                );
                // add base stalk added from deposits
                acc.base = acc.base.plus(crate.stalk);
                // add grown stalk from deposits
                acc.grown = acc.grown.plus(
                  crate.seeds
                    .times(elapsedSeasons)
                    .times(STALK_PER_SEED_PER_SEASON)
                );
                // total seeds
                acc.seeds = acc.seeds.plus(crate.seeds);
                // grown stalk since last silo update (unclaimed stalks)
                acc.unclaimed = acc.seeds
                  .times(seasonsSinceUpdate)
                  .times(STALK_PER_SEED_PER_SEASON);
                return acc;
              },
              {
                base: ZERO_BN,
                grown: ZERO_BN,
                unclaimed: ZERO_BN,
                seeds: ZERO_BN,
              }
            );
          return prev;
        },
        {}
      ),
    [balances, season]
  );
}
