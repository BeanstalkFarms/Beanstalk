import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { Deposit, Token, TokenValue } from '@beanstalk/sdk';
import useChainId from '~/hooks/chain/useChainId';
import { bigNumberResult, transform } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { MowStatus } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import { ContractFunctionParameters } from 'viem';
import { ABISnippets } from '~/constants';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import {
  resetFarmerSilo,
  updateLegacyFarmerSiloBalances,
  UpdateFarmerSiloBalancesPayload,
  updateLegacyFarmerSiloRewards,
  updateFarmerSiloBalanceSdk,
  updateFarmerSiloLoading,
  updateFarmerSiloError,
  updateFarmerSiloRan,
  updateFarmerSiloMowStatuses,
} from './actions';

type BaseToGrownStalk = {
  base: BigNumber;
  grown: BigNumber;
  seeds: BigNumber;
  unclaimed: BigNumber;
};

type SiloGettersParams = ContractFunctionParameters<
  typeof ABISnippets.siloGetters
>;

const buildMultiCall = (
  beanstalkAddress: string,
  account: string,
  whitelist: Token[]
) => {
  const whitelistAddresses = whitelist.map((t) => t.address as `0x{string}`);
  const shared = {
    address: beanstalkAddress as `0x{string}`,
    abi: ABISnippets.siloGetters,
  };
  const balanceOfStalk: SiloGettersParams = {
    ...shared,
    functionName: 'balanceOfStalk',
    args: [account as `0x{string}`],
  };
  const balOfGrownStalkMultiple: ContractFunctionParameters<
    typeof ABISnippets.siloGetters,
    'view',
    'balanceOfGrownStalkMultiple'
  > = {
    ...shared,
    functionName: 'balanceOfGrownStalkMultiple',
    args: [account as `0x{string}`, whitelistAddresses],
  };
  const rootBalance: SiloGettersParams = {
    ...shared,
    functionName: 'balanceOfRoots',
    args: [account as `0x{string}`],
  };
  const mowStatuses: SiloGettersParams = {
    ...shared,
    functionName: 'getMowStatus',
    args: [account as `0x{string}`, whitelistAddresses],
  };
  const balanceOfEarnedBeans: SiloGettersParams = {
    ...shared,
    functionName: 'balanceOfEarnedBeans',
    args: [account as `0x{string}`],
  };

  return [
    balanceOfStalk,
    balOfGrownStalkMultiple,
    rootBalance,
    balanceOfEarnedBeans,
    mowStatuses,
  ];
};

type MultiCallResult = Awaited<
  ReturnType<typeof multicall<typeof config, ReturnType<typeof buildMultiCall>>>
>;

const parseMultiCallResult = (
  sdk: ReturnType<typeof useSdk>,
  result: MultiCallResult
) => {
  const [
    _activeStalkBalance,
    _grownStalkBalance,
    _rootBalance,
    _earnedBeanBalance,
    _mowStatuses,
  ] = result;

  const activeStalkBalance = transform(
    _activeStalkBalance.result || 0n,
    'bnjs',
    sdk.tokens.STALK
  );
};

export const useFetchFarmerSilo = () => {
  /// Helpers
  const dispatch = useDispatch();

  /// Contracts
  const sdk = useSdk();
  const beanstalk = sdk.contracts.beanstalk;

  /// Data
  const account = useAccount();
  const season = useSeason();

  ///
  const initialized = !!(beanstalk && account && season?.gt(0));

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      dispatch(updateFarmerSiloLoading(true));
      console.debug('[farmer/silo/useFarmerSilo] FETCH');

      const whitelist = [...sdk.tokens.siloWhitelist];

      const calls = buildMultiCall(beanstalk.address, account, whitelist);

      const multiCallResult = await multicall(config, { contracts: calls });
      console.log('multiCallResult', multiCallResult);
      // const activeStalkBal = _activeStalkBalance.result;

      // FIXME: multicall this section
      // FIXME: translate?
      const [
        activeStalkBalance,
        { grownStalkBalance, grownStalkByToken },
        rootBalance,
        earnedBeanBalance,
        mowStatuses,
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

        sdk.contracts.beanstalk
          .getMowStatus(
            account,
            whitelist.map((t) => t.address)
          )
          .then((statuses) => {
            const entries = whitelist.map(
              (tk, i) => [tk, statuses[i]] as const
            );
            return new Map<Token, MowStatus>(entries);
          }),
        // Get the mowStatus struct for each whitelisted token
        // Promise.all(
        //   [...sdk.tokens.siloWhitelist].map((token) =>
        //     sdk.contracts.beanstalk
        //       .getMowStatus(account, [token.address])
        //       .then((status) => [token, status[0]] as const)
        //   )
        // ).then((statuses) => new Map<Token, MowStatus>(statuses)),
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
        ): Deposit<BigNumber> => ({
          id: crate.id,
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
      dispatch(updateFarmerSiloMowStatuses(mowStatuses));
      dispatch(updateFarmerSiloBalanceSdk(balances));

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
  }, [initialized, sdk, account, dispatch]);

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
