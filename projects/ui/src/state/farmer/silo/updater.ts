import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { DataSource } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { BEAN_TO_SEEDS, BEAN_TO_STALK, ZERO_BN } from '~/constants';
import { BEAN } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import {
  bigNumberResult,
  tokenResult,
  tokenValueToBN,
  transform,
} from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import {
  resetFarmerSilo,
  updateLegacyFarmerSiloBalances,
  UpdateFarmerSiloBalancesPayload,
  updateFarmerMigrationStatus,
  updateLegacyFarmerSiloRewards,
} from './actions';
import useSdk from '~/hooks/sdk';
import { LegacyDepositCrate } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';

type SiloV3StaticData = {
  deposits: {
    [tokenAddress: string]: {
      [season: string]: { amount: string; bdv: string };
    };
  };
  merkle: {
    stalk: string;
    seeds: string;
    leaf: string;
    proof: string[];
  };
};

export const fetchMigrationData = async (account: string) =>
  axios
    .get(
      `${
        process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : ''
      }${'/.netlify/functions/silov3'}`,
      { params: { account } }
    )
    .then((r) => r.data as SiloV3StaticData);

export const useFetchFarmerSilo = () => {
  /// Helpers
  const dispatch = useDispatch();

  /// Contracts
  const beanstalk = useBeanstalkContract();
  const sdk = useSdk();

  /// Data
  const account = useAccount();
  const season = useSeason();

  ///
  const initialized = !!(
    beanstalk &&
    account &&
    sdk.contracts.beanstalk &&
    season?.gt(0)
  );

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      console.debug('[farmer/silo/useFarmerSilo] FETCH');

      // FIXME: multicall this section
      // FIXME: translate?
      const [
        stalkBalance,
        grownStalkBalance,
        seedBalance,
        rootBalance,
        earnedBeanBalance,
        migrationNeeded,
        // lastUpdate,
        // allEvents = [],
      ] = await Promise.all([
        // `getStalk()` returns `stalk + earnedStalk` but NOT grown stalk
        sdk.silo.getStalk(account).then(tokenValueToBN),
        sdk.silo.getGrownStalk(account).then(tokenValueToBN),

        // After Silo V3 migration, getSeeds() will always return zero.
        // Seeds have to be calculated by summing up BDV across deposits
        sdk.silo.getSeeds(account).then(tokenValueToBN),
        sdk.contracts.beanstalk.balanceOfRoots(account).then(bigNumberResult),
        sdk.contracts.beanstalk
          .balanceOfEarnedBeans(account)
          .then(tokenResult(BEAN)),

        // FIXME: this only needs to get fetched once and then can probably be cached
        // in LocalStorage or at least moved to a separate updater to prevent it from
        // getting called every time the farmer refreshes their Silo
        sdk.contracts.beanstalk.migrationNeeded(account),
        // beanstalk.lastUpdate(account).then(bigNumberResult),

        // sdk.contracts.beanstalk.depositedB
      ] as const);

      /// stalk + earnedStalk (bundled together at the contract level)
      const activeStalkBalance = stalkBalance;
      /// earnedStalk (this is already included in activeStalk)
      const earnedStalkBalance = earnedBeanBalance.times(BEAN_TO_STALK);
      /// earnedSeed  (aka plantable seeds)
      const earnedSeedBalance = earnedBeanBalance.times(BEAN_TO_SEEDS);

      dispatch(updateFarmerMigrationStatus(migrationNeeded));

      // total:   active & inactive
      // active:  owned, actively earning other silo assets
      // earned:  active but not yet deposited into a Season
      // grown:   inactive
      dispatch(
        updateLegacyFarmerSiloRewards({
          beans: {
            earned: earnedBeanBalance,
          },
          stalk: {
            active: activeStalkBalance,
            earned: earnedStalkBalance,
            grown: grownStalkBalance,
            total: activeStalkBalance.plus(grownStalkBalance),
          },
          seeds: {
            active: seedBalance,
            earned: earnedSeedBalance,
            total: seedBalance.plus(earnedSeedBalance),
          },
          roots: {
            total: rootBalance,
          },
        })
      );

      if (migrationNeeded) {
        // After the migration block is locked in, no deposits can change in
        // Silo V2, so we use a flatfile with silo data for each account to
        // prevent the needed to support two different historical event schemas.
        const balances = await fetchMigrationData(account);

        // const currentSeason = TokenValue.fromBlockchain(season.toString(), 0);

        // Transform the flatfile data into the legacy UI data structure
        const temp: UpdateFarmerSiloBalancesPayload = {};
        Object.entries(balances.deposits).forEach(
          ([addr, depositsBySeason]) => {
            // All of the tokens addresses in the flatfile
            // should exist in the SDK already
            const token = sdk.tokens.findByAddress(addr);
            if (!token) return;

            temp[token.address] = {
              deposited: {
                // Note that deposits in the flatfile are keyed by season
                // instead of stem
                ...Object.keys(depositsBySeason).reduce(
                  (dep, depositSeason) => {
                    const crate = depositsBySeason[depositSeason];

                    // For simplicity we operate here with TokenValues using the SDK
                    const bdvTV = sdk.tokens.BEAN.fromBlockchain(crate.bdv);
                    const amountTV = token.fromBlockchain(crate.amount);
                    const baseStalkTV = token.getStalk(bdvTV);
                    const seedsTV = token.getSeeds(bdvTV);

                    // Legacy grown stalk calculation
                    const grownStalkTV = sdk.silo.calculateGrownStalkSeeds(
                      season.toString(),
                      depositSeason.toString(),
                      seedsTV
                    );

                    // Legacy BigNumberJS values
                    const bdv = transform(bdvTV, 'bnjs');
                    const amount = transform(amountTV, 'bnjs');

                    // Update totals
                    dep.amount = dep.amount.plus(amount);
                    dep.bdv = dep.bdv.plus(bdv);

                    // Create deposit crate
                    dep.crates.push({
                      stem: ethers.BigNumber.from(depositSeason),
                      amount: amount,
                      bdv: bdv,
                      stalk: {
                        base: transform(baseStalkTV, 'bnjs', sdk.tokens.STALK),
                        grown: transform(
                          grownStalkTV,
                          'bnjs',
                          sdk.tokens.STALK
                        ),
                        total: transform(
                          grownStalkTV.add(baseStalkTV),
                          'bnjs',
                          sdk.tokens.STALK
                        ),
                      },
                      seeds: transform(seedsTV, 'bnjs'),
                    });
                    return dep;
                  },
                  {
                    amount: ZERO_BN,
                    bdv: ZERO_BN,
                    crates: [] as LegacyDepositCrate[], // FIXME
                  }
                ),
              },
            };
          }
        );

        dispatch(updateLegacyFarmerSiloBalances(temp));
      } else {
        const balances = await sdk.silo.getBalances(account, {
          source: DataSource.LEDGER,
        });

        const temp: UpdateFarmerSiloBalancesPayload = {};
        balances.forEach((balance, token) => {
          temp[token.address] = {
            deposited: {
              amount: transform(balance.amount, 'bnjs', token),
              bdv: transform(balance.bdv, 'bnjs', sdk.tokens.BEAN),
              crates: balance.deposits.map((crate) => ({
                stem: transform(crate.stem, 'bnjs'), // FIXME
                amount: transform(crate.amount, 'bnjs', token),
                bdv: transform(crate.bdv, 'bnjs', sdk.tokens.BEAN),
                stalk: {
                  base: transform(crate.stalk.base, 'bnjs', sdk.tokens.STALK),
                  grown: transform(crate.stalk.grown, 'bnjs', sdk.tokens.STALK),
                  total: transform(crate.stalk.total, 'bnjs', sdk.tokens.STALK),
                },
                seeds: transform(crate.seeds, 'bnjs'),
              })),
            },
          };
        });

        dispatch(updateLegacyFarmerSiloBalances(temp));
      }
    }
  }, [initialized, sdk, account, dispatch, season]);

  const clear = useCallback(
    (_account?: string) => {
      console.debug(`[farmer/silo/useFarmerSilo] CLEAR ${_account}`);
      dispatch(resetFarmerSilo());
    },
    [dispatch]
  );

  return [fetch, initialized, clear] as const;
};

// -- Updater

const FarmerSiloUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerSilo();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear(account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerSiloUpdater;
