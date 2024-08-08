import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import axios from 'axios';
import { Deposit, Token, TokenValue } from '@beanstalk/sdk';
import { TokenMap, ZERO_BN } from '~/constants';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import { bigNumberResult, transform } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { LegacyDepositCrate } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import {
  resetFarmerSilo,
  updateLegacyFarmerSiloBalances,
  UpdateFarmerSiloBalancesPayload,
  updateLegacyFarmerSiloRewards,
  updateFarmerSiloBalanceSdk,
  updateFarmerSiloLoading,
  updateFarmerSiloError,
  updateFarmerSiloRan,
} from './actions';

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

type BaseToGrownStalk = {
  base: BigNumber;
  grown: BigNumber;
  seeds: BigNumber;
  unclaimed: BigNumber;
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
      dispatch(updateFarmerSiloLoading(true));
      console.debug('[farmer/silo/useFarmerSilo] FETCH');

      // FIXME: multicall this section
      // FIXME: translate?
      const [
        activeStalkBalance,
        { grownStalkBalance, grownStalkByToken },
        rootBalance,
        earnedBeanBalance,
        // migrationNeeded,
        mowStatuses,
        lastUpdate,
        stemTips,
      ] = await Promise.all([
        // `getStalk()` returns `stalk + earnedStalk` but NOT grown stalk
        sdk.silo.getStalk(account),

        // Get grown stalk for each individual token
        Promise.all(
          [...sdk.tokens.siloWhitelist].map((token) =>
            sdk.contracts.beanstalk
              .balanceOfGrownStalk(account, token.address)
              .then(
                (result) =>
                  [token, sdk.tokens.STALK.fromBlockchain(result)] as const
              )
          )
        ).then((results) => ({
          grownStalkBalance: results.reduce(
            (acc, [_, result]) => acc.add(result),
            sdk.tokens.STALK.amount(0)
          ),
          grownStalkByToken: new Map<Token, TokenValue>(results),
        })),

        sdk.contracts.beanstalk.balanceOfRoots(account).then(bigNumberResult),
        sdk.silo.getEarnedBeans(account),

        // FIXME: this only needs to get fetched once and then can probably be cached
        // in LocalStorage or at least moved to a separate updater to prevent it from
        // getting called every time the farmer refreshes their Silo
        // sdk.contracts.beanstalk.migrationNeeded(account),

        // Get the mowStatus struct for each whitelisted token
        Promise.all(
          [...sdk.tokens.siloWhitelist].map((token) =>
            sdk.contracts.beanstalk
              .getMowStatus(account, token.address)
              .then((status) => [token, status] as const)
          )
        ).then(
          (statuses) =>
            new Map<
              Token,
              // eslint-disable-next-line
              Awaited<ReturnType<typeof sdk.contracts.beanstalk.getMowStatus>>
            >(statuses)
        ),
        beanstalk.lastUpdate(account),
        sdk.silo.getStemTips([...sdk.tokens.siloWhitelist]),
      ] as const);

      // dispatch(updateFarmerMigrationStatus(migrationNeeded));

      // Transform the flatfile data into the legacy UI data structure
      const payload: UpdateFarmerSiloBalancesPayload = {};

      let activeSeedBalance: TokenValue = TokenValue.ZERO;
      const balances = await sdk.silo.getBalances(account);
      balances.forEach((balance, token) => {
        // Post-migration, # of active seeds is calc'd from BDV
        activeSeedBalance = activeSeedBalance.add(token.getSeeds(balance.bdv));
        const handleCrate = (
          crate: Deposit<TokenValue>
        ): LegacyDepositCrate => ({
          // stem: transform(crate.stem, 'bnjs'), // FIXME
          // ALECKS: I changed above line to below line. Typescript was expecting stem to be ethers.BigNumber
          // Leaving this comment here in case there's unexpected issues somewhere downstream.
          stem: crate.stem,
          amount: transform(crate.amount, 'bnjs', token),
          bdv: transform(crate.bdv, 'bnjs', sdk.tokens.BEAN),
          stalk: {
            base: transform(crate.stalk.base, 'bnjs', sdk.tokens.STALK),
            grown: transform(crate.stalk.grown, 'bnjs', sdk.tokens.STALK),
            total: transform(crate.stalk.total, 'bnjs', sdk.tokens.STALK),
          },
          seeds: transform(crate.seeds, 'bnjs'),
          isGerminating: crate.isGerminating,
        });

        payload[token.address] = {
          mowStatus: mowStatuses.get(token),
          deposited: {
            amount: transform(balance.amount, 'bnjs', token),
            convertibleAmount: transform(
              balance.convertibleAmount,
              'bnjs',
              token
            ),
            bdv: transform(balance.bdv, 'bnjs', sdk.tokens.BEAN),
            crates: balance.deposits.map(handleCrate),
            convertibleCrates: balance.convertibleDeposits.map(handleCrate),
          },
        };
      });

      dispatch(updateFarmerSiloBalanceSdk(balances));

      /**
       * We need to calculate the stalk for un-migrated accounts differently than migrated ones
       */

      // First aggregate all crates per token
      const stalkPerTokenForUnMigrated = Object.entries(payload).reduce<
        TokenMap<BaseToGrownStalk>
      >((prev, [tokenAddress, tokenBalances]) => {
        if (!season) return prev;
        prev[tokenAddress] =
          tokenBalances.deposited!.crates.reduce<BaseToGrownStalk>(
            (acc, crate) => {
              acc.base = acc.base.plus(crate.stalk.base);
              acc.grown = acc.grown.plus(crate.stalk.grown);
              acc.seeds = acc.seeds.plus(crate.seeds);
              acc.unclaimed = ZERO_BN;
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
      }, {});

      // Then aggregate all tokens
      const stalkForUnMigrated = Object.entries(
        stalkPerTokenForUnMigrated
      ).reduce(
        (prev, [_, data]) => {
          prev.base = prev.base.plus(data.base);
          prev.grown = prev.grown.plus(data.grown);

          return prev;
        },
        {
          base: ZERO_BN,
          grown: ZERO_BN,
          earned: transform(
            sdk.tokens.BEAN.getStalk(earnedBeanBalance),
            'bnjs'
          ),
          total: ZERO_BN,
        }
      );
      stalkForUnMigrated.total = stalkForUnMigrated.base.plus(
        stalkForUnMigrated.grown
      );
      // .plus(stalkForUnMigrated.earned);
      // End of un-migrated stalk calculation

      const earnedStalkBalance = sdk.tokens.BEAN.getStalk(earnedBeanBalance);
      const earnedSeedBalance = sdk.tokens.BEAN.getSeeds(earnedBeanBalance);
      const totalStalkBalance = activeStalkBalance.add(grownStalkBalance);
      const totalSeedbalance = activeSeedBalance.add(earnedSeedBalance);

      // total:   active & inactive
      // active:  owned, actively earning other silo assets
      // earned:  active but not yet deposited into a Season
      // grown:   inactive
      const rewards = {
        beans: {
          earned: transform(earnedBeanBalance, 'bnjs', sdk.tokens.BEAN),
        },
        stalk: {
          active: transform(activeStalkBalance, 'bnjs', sdk.tokens.STALK),
          earned: transform(earnedStalkBalance, 'bnjs', sdk.tokens.STALK),
          grown: transform(grownStalkBalance, 'bnjs', sdk.tokens.STALK),
          total: transform(totalStalkBalance, 'bnjs', sdk.tokens.STALK),
          grownByToken: grownStalkByToken,
        },
        seeds: {
          active: transform(activeSeedBalance, 'bnjs', sdk.tokens.SEEDS),
          earned: transform(earnedSeedBalance, 'bnjs', sdk.tokens.SEEDS),
          total: transform(totalSeedbalance, 'bnjs', sdk.tokens.SEEDS),
        },
        roots: {
          total: rootBalance,
        },
      };

      dispatch(updateLegacyFarmerSiloRewards(rewards));

      // HEADS UP: this has to be called after updateLegacyFarmerSiloRewards
      // to prevent some rendering errors. Refactor later.
      dispatch(updateLegacyFarmerSiloBalances(payload));
      dispatch(updateFarmerSiloLoading(false));
    }
  }, [initialized, sdk, account, dispatch, beanstalk, season]);

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
  const dispatch = useDispatch();

  useEffect(() => {
    clear(account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    if (account && initialized) {
      dispatch(updateFarmerSiloError(undefined));
      fetch()
        .catch((err) => {
          if ((err as Error).message.includes('limit the query')) {
            dispatch(
              updateFarmerSiloError(
                'Error while loading Silo data. RPC query limit exceeded.'
              )
            );
            console.log(
              'Failed to fetch Silo events: RPC query limit exceeded'
            );
          } else {
            dispatch(
              updateFarmerSiloError(
                'Error loading silo data. Check console for details.'
              )
            );
            console.log('Error loading silo data: ', err.message);
          }
        })
        .finally(() => {
          dispatch(updateFarmerSiloLoading(false));
          dispatch(updateFarmerSiloRan(true));
        });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerSiloUpdater;
