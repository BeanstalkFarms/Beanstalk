import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import BigNumberJS from 'bignumber.js';
import { DataSource } from '@beanstalk/sdk';
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
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import useSeason from '~/hooks/beanstalk/useSeason';
import {
  resetFarmerSilo,
  updateFarmerSiloBalances,
  UpdateFarmerSiloBalancesPayload,
  updateFarmerMigrationStatus,
  updateFarmerSiloRewards,
} from './actions';
import useSdk from '~/hooks/sdk';
import { LegacyDepositCrate } from '~/state/farmer/silo';

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
  const whitelist = useWhitelist();
  const season = useSeason();

  /// Events
  // const getEvents = useCallback<GetEventsFn>(
  //   async (_account, fromBlock, toBlock) =>
  //     sdk.events.get('silo', [
  //       _account,
  //       {
  //         token: undefined, // get all tokens
  //         fromBlock, // let cache system choose where to start
  //         toBlock, // let cache system choose where to end
  //       },
  //     ]),
  //   [sdk.events]
  // );
  // const [fetchSiloEvents] = useEvents('silo', getEvents);

  ///
  const initialized = !!(
    (beanstalk && account && sdk.contracts.beanstalk)
    // season?.gt(0)
    // fetchSiloEvents &&
  );

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      console.debug('[farmer/silo/useFarmerSilo] FETCH');

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
        // FIXME: multicall this section
        // FIXME: translate?
        sdk.silo.getStalk(account).then(tokenValueToBN), // returns `stalk + earnedStalk`
        sdk.silo.getGrownStalk(account).then(tokenValueToBN),
        sdk.silo.getSeeds(account).then(tokenValueToBN),
        beanstalk.balanceOfRoots(account).then(bigNumberResult),
        beanstalk.balanceOfEarnedBeans(account).then(tokenResult(BEAN)),
        sdk.contracts.beanstalk.migrationNeeded(account),
        // beanstalk.lastUpdate(account).then(bigNumberResult),
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
        updateFarmerSiloRewards({
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
        const balances = await fetchMigrationData(account);

        const temp: UpdateFarmerSiloBalancesPayload = {};
        Object.entries(balances.deposits).forEach(
          ([addr, depositsBySeason]) => {
            const token = sdk.tokens.findByAddress(addr);
            if (!token) return;
            temp[token.address] = {
              deposited: {
                ...Object.keys(depositsBySeason).reduce(
                  (dep, depositSeason) => {
                    const crate = depositsBySeason[depositSeason];

                    const bdvTV = sdk.tokens.BEAN.fromBlockchain(crate.bdv);
                    const amountTV = token.fromBlockchain(crate.amount);
                    const seedsTV = token.getSeeds(bdvTV);
                    const stalkTV = token.getStalk(bdvTV);

                    const bdv = transform(bdvTV, 'bnjs');
                    const amount = transform(amountTV, 'bnjs');

                    dep.amount = dep.amount.plus(amount);
                    dep.bdv = dep.bdv.plus(bdv);

                    // const currentSeason = season.gt(0) ? season.toString() : '12793'; // FIXME
                    // const grownStalk = sdk.silo.calculateGrownStalkSeeds(
                    //   currentSeason,
                    //   depositSeason,
                    //   seedsTV
                    // );
                    // console.log({
                    //   currentSeason,
                    //   depositSeason,
                    //   seedsTV: seedsTV.toBlockchain(),
                    //   grownStalk
                    // })

                    dep.crates.push({
                      season: new BigNumberJS(depositSeason),
                      amount: amount,
                      bdv: bdv,
                      // FIXME: this is base stalk
                      stalk: transform(stalkTV, 'bnjs', sdk.tokens.STALK),
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

        dispatch(updateFarmerSiloBalances(temp));
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
                season: transform(crate.stem, 'bnjs'), // FIXME
                amount: transform(crate.amount, 'bnjs', token),
                bdv: transform(crate.bdv, 'bnjs', sdk.tokens.BEAN),
                stalk: transform(crate.stalk.total, 'bnjs', sdk.tokens.STALK), // FIXME: base or total?
                seeds: transform(crate.seeds, 'bnjs'),
              })),
            },
          };
        });

        dispatch(updateFarmerSiloBalances(temp));
      }
    }
  }, [initialized, sdk, account, beanstalk, dispatch]);

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
