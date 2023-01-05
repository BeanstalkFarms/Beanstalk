import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { BEAN_TO_SEEDS, BEAN_TO_STALK, ZERO_BN } from '~/constants';
import { BEAN, SEEDS, STALK } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import { bigNumberResult, tokenResult } from '~/util';
import useBlocks from '~/hooks/ledger/useBlocks';
import useAccount from '~/hooks/ledger/useAccount';
import EventProcessor from '~/lib/Beanstalk/EventProcessor';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import useSeason from '~/hooks/beanstalk/useSeason';
import { DepositCrate } from '.';
import { EventCacheName } from '../events2';
import useEvents, { GetQueryFilters } from '../events2/updater';
import { resetFarmerSilo, updateFarmerSiloBalances, UpdateFarmerSiloBalancesPayload, updateFarmerSiloRewards } from './actions';

export const useFetchFarmerSilo = () => {
  /// Helpers
  const dispatch  = useDispatch();

  /// Contracts
  const beanstalk = useBeanstalkContract();

  /// Data
  const account   = useAccount();
  const blocks    = useBlocks();
  const whitelist = useWhitelist();
  const season    = useSeason();

  /// Events
  const getQueryFilters = useCallback<GetQueryFilters>(
    (_account, fromBlock, toBlock,) => ([
      // Silo (Generalized v2)
      beanstalk.queryFilter(
        beanstalk.filters.AddDeposit(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
      beanstalk.queryFilter(
        beanstalk.filters.AddWithdrawal(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
      beanstalk.queryFilter(
        beanstalk.filters.RemoveWithdrawal(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
      beanstalk.queryFilter(
        beanstalk.filters.RemoveWithdrawals(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
      beanstalk.queryFilter(
        beanstalk.filters.RemoveDeposit(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
      beanstalk.queryFilter(
        beanstalk.filters.RemoveDeposits(_account),
        fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
        toBlock   || 'latest',
      ),
    ]),
    [beanstalk, blocks.BEANSTALK_GENESIS_BLOCK]
  );
  
  const [fetchSiloEvents] = useEvents(EventCacheName.SILO, getQueryFilters);
  
  ///
  const initialized = !!(
    beanstalk
    && account
    && fetchSiloEvents
    && season?.gt(0)
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
        allEvents = []
      ] = await Promise.all([
        // FIXME: multicall this section
        /// balanceOfStalk() returns `stalk + earnedStalk`
        beanstalk.balanceOfStalk(account).then(tokenResult(STALK)),
        beanstalk.balanceOfGrownStalk(account).then(tokenResult(STALK)),
        beanstalk.balanceOfSeeds(account).then(tokenResult(SEEDS)),
        beanstalk.balanceOfRoots(account).then(bigNumberResult),
        beanstalk.balanceOfEarnedBeans(account).then(tokenResult(BEAN)),
        fetchSiloEvents(),
      ] as const);

      // console.debug('[farmer/silo/useFarmerSilo] RESULT', [
      //   stalkBalance.toString(),
      //   seedBalance.toString(),
      //   rootBalance.toString(),
      //   earnedBeanBalance.toString(),
      //   grownStalkBalance.toString(),
      // ]);

      /// stalk + earnedStalk (bundled together at the contract level)
      const activeStalkBalance = stalkBalance;
      /// earnedStalk (this is already included in activeStalk)
      const earnedStalkBalance = earnedBeanBalance.times(BEAN_TO_STALK);
      /// earnedSeed  (aka plantable seeds)
      const earnedSeedBalance  = earnedBeanBalance.times(BEAN_TO_SEEDS);
      
      // total:   active & inactive
      // active:  owned, actively earning other silo assets
      // earned:  active but not yet deposited into a Season
      // grown:   inactive
      dispatch(updateFarmerSiloRewards({
        beans: {
          earned: earnedBeanBalance,
        },
        stalk: {
          active: activeStalkBalance,
          earned: earnedStalkBalance,
          grown:  grownStalkBalance,
          total:  activeStalkBalance.plus(grownStalkBalance),
        },
        seeds: {
          active: seedBalance,
          earned: earnedSeedBalance,
          total:  seedBalance.plus(earnedSeedBalance),
        },
        roots: {
          total: rootBalance,
        }
      }));

      const p = new EventProcessor(account, { season, whitelist });
      const results = p.ingestAll(allEvents);

      dispatch(updateFarmerSiloBalances(
        Object.keys(whitelist).reduce<UpdateFarmerSiloBalancesPayload>((prev, addr) => {
          prev[addr] = {
            deposited: {
              ...Object.keys(results.deposits[addr]).reduce((dep, s) => {
                const crate = results.deposits[addr][s];
                const bdv   = crate.bdv;
                dep.amount  = dep.amount.plus(crate.amount);
                dep.bdv     = dep.bdv.plus(bdv);
                dep.crates.push({
                  season: new BigNumber(s),
                  amount: crate.amount,
                  bdv:    bdv,
                  stalk:  whitelist[addr].getStalk(bdv),
                  seeds:  whitelist[addr].getSeeds(bdv),
                });
                return dep;
              }, {
                amount: ZERO_BN,
                bdv:    ZERO_BN,
                crates: [] as DepositCrate[],
              })
            },
            // Splits into 'withdrawn' and 'claimable'
            ...p.parseWithdrawals(addr, season)
          };
          return prev;
        }, {})
      ));
    }
  }, [
    dispatch,
    fetchSiloEvents,
    beanstalk,
    season,
    whitelist,
    account,
    initialized,
  ]);
  
  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerSilo] CLEAR');
    dispatch(resetFarmerSilo());
  }, [dispatch]);

  return [fetch, initialized, clear] as const;
};

// -- Updater

const FarmerSiloUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerSilo();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerSiloUpdater;
