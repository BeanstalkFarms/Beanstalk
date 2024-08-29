import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { Deposit, Token, TokenValue } from '@beanstalk/sdk';
import useChainId from '~/hooks/chain/useChainId';
import { transform } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { MowStatus } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import { ContractFunctionParameters } from 'viem';
import { ABISnippets } from '~/constants';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import { ethers } from 'ethers';
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

export const useFetchFarmerSilo = () => {
  /// Sdk
  const sdk = useSdk();

  /// Helpers
  const dispatch = useDispatch();

  /// Data
  const account = useAccount();
  const season = useSeason();

  /// Contracts
  const beanstalk = sdk.contracts.beanstalk;

  ///
  const initialized = !!(beanstalk && account && season?.gt(0));

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      dispatch(updateFarmerSiloLoading(true));
      console.debug('[farmer/silo/useFarmerSilo] FETCH');

      const whitelist = [...sdk.tokens.siloWhitelist];
      const numTokens = whitelist.length;

      const data = await multicall(config, {
        contracts: buildMultiCall(beanstalk.address, account, whitelist),
      }).then((result) => ({
        activeStalk: extractResult(result[0], -1n),
        rootBalance: extractResult(result[2], -1n),
        earnedBeans: extractResult(result[3], -1n),
        grownStalk: extractArrayResult<bigint>(result[1], numTokens, 0n),
        mowStatuses: extractArrayResult<MowStatus<bigint>>(
          result[4],
          numTokens,
          { bdv: 0n, lastStem: 0n }
        ),
      }));

      console.debug('[farmer/silo/useFarmerSilo] multicall result: ', data);

      const activeStalkBalance = transform(
        data.activeStalk,
        'tokenValue',
        sdk.tokens.STALK
      );

      console.log('grownStalkBal: ', data.grownStalk);

      const grownStalkByToken = new Map<Token, TokenValue>();
      const grownStalkBalance = whitelist.reduce<TokenValue>(
        (memo, token, i) => {
          const balance = sdk.tokens.STALK.fromBlockchain(data.grownStalk[i]);
          if (balance.gt(0)) {
            console.log(token.symbol, ' - grownStalkBal: ', balance.toHuman());
          }
          grownStalkByToken.set(token, balance);
          memo = memo.add(balance);
          return memo;
        },
        sdk.tokens.STALK.amount(0)
      );
      const rootBalance = transform(data.rootBalance, 'bnjs');
      const earnedBeanBalance = sdk.tokens.BEAN.fromBlockchain(
        data.earnedBeans
      );

      const mowStatuses = new Map<Token, MowStatus>(
        whitelist.map((token, i) => {
          const mowStatus = {
            bdv: ethers.BigNumber.from(data.mowStatuses[i].bdv),
            lastStem: ethers.BigNumber.from(data.mowStatuses[i].lastStem),
          };
          return [token, mowStatus] as const;
        })
      );

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

// -- Helper Types

type CallParams = ContractFunctionParameters<typeof ABISnippets.siloGetters>;

type CallResult = Awaited<
  ReturnType<typeof multicall<typeof config, CallParams[]>>
>[number];

// -- Helpers

function extractArrayResult<T>(
  result: CallResult,
  length: number,
  defaultValue: T
): T[] {
  if (result.error) return Array.from({ length }, () => defaultValue);
  return result.result as unknown as T[];
}

function extractResult(result: CallResult, defaultValue: bigint): bigint {
  if (result.error) return defaultValue;
  return result.result;
}

function buildMultiCall(
  beanstalkAddress: string,
  _account: string,
  whitelist: Token[]
): CallParams[] {
  const whitelistAddresses = whitelist.map((t) => t.address as `0x{string}`);
  const contract = {
    address: beanstalkAddress as `0x{string}`,
    abi: ABISnippets.siloGetters,
  };
  const account = _account as `0x{string}`;

  const calls: CallParams[] = [
    {
      ...contract,
      functionName: 'balanceOfStalk',
      args: [account],
    },
    {
      ...contract,
      functionName: 'balanceOfGrownStalkMultiple',
      args: [account, whitelistAddresses],
    },
    {
      ...contract,
      functionName: 'balanceOfRoots',
      args: [account],
    },
    {
      ...contract,
      functionName: 'balanceOfEarnedBeans',
      args: [account],
    },
    {
      ...contract,
      functionName: 'getMowStatus',
      args: [account, whitelistAddresses],
    },
  ];

  return calls;
}
