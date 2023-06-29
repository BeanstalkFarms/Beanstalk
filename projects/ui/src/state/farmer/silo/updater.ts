import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { DataSource } from '@beanstalk/sdk';
import { BEAN_TO_SEEDS, BEAN_TO_STALK } from '~/constants';
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
        lastUpdate,
        migrationNeeded,
        // allEvents = [],
      ] = await Promise.all([
        // FIXME: multicall this section
        // FIXME: translate?
        sdk.silo.getStalk(account).then(tokenValueToBN), // returns `stalk + earnedStalk`
        sdk.silo.getGrownStalk(account).then(tokenValueToBN),
        sdk.silo.getSeeds(account).then(tokenValueToBN),
        beanstalk.balanceOfRoots(account).then(bigNumberResult),
        beanstalk.balanceOfEarnedBeans(account).then(tokenResult(BEAN)),
        beanstalk.lastUpdate(account).then(bigNumberResult),
        sdk.contracts.beanstalk.migrationNeeded(account),
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

      if (!migrationNeeded) {
        const farmerSiloBalances = await sdk.silo
          .getBalances(account, { source: DataSource.SUBGRAPH })
          .then((balances) => {
            const temp: UpdateFarmerSiloBalancesPayload = {};
            console.log('balances', balances);
            balances.forEach((balance, token) => {
              temp[token.address] = {
                deposited: {
                  amount: transform(balance.amount, 'bnjs'),
                  bdv: transform(balance.bdv, 'bnjs'),
                  crates: [],
                },
              };
            });
            return temp;
          });
        dispatch(updateFarmerSiloBalances(farmerSiloBalances));
      }

      // const p = new EventProcessor(sdk, account);
      // const results = p.ingestAll(allEvents);

      // dispatch(
      //   updateFarmerSiloBalances(
      //     [...sdk.tokens.siloWhitelist].reduce<UpdateFarmerSiloBalancesPayload>(
      //       (prev, token) => {
      //         const depositsOfToken = results.deposits.get(token);
      //         if (!depositsOfToken) return prev;
      //         const stems = Object.keys(depositsOfToken);

      //         // Convert from map => object
      //         prev[token.address] = {
      //           lastUpdate: lastUpdate,
      //           deposited: {
      //             ...stems.reduce(
      //               (dep, stem) => {
      //                 const crate = depositsOfToken[stem];

      //                 // TODO:
      //                 const bdv = transform(crate.bdv, 'bnjs');
      //                 const amount = transform(crate.amount, 'bnjs');

      //                 dep.amount = dep.amount.plus(amount);
      //                 dep.bdv = dep.bdv.plus(bdv);
      //                 dep.crates.push({
      //                   season: new BigNumberJS(stem),
      //                   amount,
      //                   bdv,
      //                   // FIXME: recalculate these?
      //                   stalk: new BigNumberJS(0), // tokenValueToBN(token.getStalk(bdv)),
      //                   seeds: new BigNumberJS(0), // token.getSeeds(bdv),
      //                 });
      //                 return dep;
      //               },
      //               {
      //                 amount: ZERO_BN,
      //                 bdv: ZERO_BN,
      //                 crates: [] as DepositCrate[],
      //               }
      //             ),
      //           },
      //         };
      //         return prev;
      //       },
      //       {}
      //     )
      //   )
      // );
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
