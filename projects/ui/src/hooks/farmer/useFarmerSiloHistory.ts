import { useMemo } from 'react';
import {
  SeasonalInstantPriceQuery,
  useFarmerSiloAssetSnapshotsLazyQuery,
  useFarmerSiloRewardsLazyQuery,
  useWhitelistTokenRewardsQuery,
} from '~/generated/graphql';
import useSeasonsQuery, {
  SeasonRange,
} from '~/hooks/beanstalk/useSeasonsQuery';
import useInterpolateDeposits from '~/hooks/farmer/useInterpolateDeposits';
import useInterpolateStalk from '~/hooks/farmer/useInterpolateStalk';
import { useQuery } from '@tanstack/react-query';
import { useGetChainAgnosticLegacyToken } from '~/hooks/beanstalk/useTokens';
import {
  subgraphQueryConfigs,
  subgraphQueryKeys as queryKeys,
} from '~/util/Graph';
import { getTokenIndex } from '~/util';
import { RESEED_SEASON } from '~/constants';
import useFarmerBalancesBreakdown from './useFarmerBalancesBreakdown';
import useChainId from '../chain/useChainId';

export const useMergedFarmerSiloRewardsQuery = (
  account: string | undefined
) => {
  const chainId = useChainId();
  const [execute] = useFarmerSiloRewardsLazyQuery({
    variables: { account: account || '' },
    fetchPolicy: 'cache-and-network',
  });

  const query = useQuery({
    queryKey: [[chainId], ...queryKeys.farmerSiloRewards(account)],
    queryFn: async () => {
      console.debug('[useMergedFarmerSiloRewardsQuery] fetching...');
      const l1 = await execute({
        context: { subgraph: 'beanstalk_eth' },
      });
      const l2 = await execute({
        context: { subgraph: 'beanstalk' },
      });

      const data = [
        ...(l1.data?.snapshots ?? []),
        ...(l2.data?.snapshots ?? []),
      ];
      console.debug('[useMergedFarmerSiloRewardsQuery] result', data);

      return data.sort((a, b) => b.season - a.season);
    },
    enabled: !!account,
    staleTime: 1000 * 60 * 20, // 20 mins
  });

  return query;
};

export type FarmerSiloAssetSnapshot = {
  __typename: 'SiloAssetHourlySnapshot';
  id: string;
  season: number;
  deltaDepositedBDV: any;
  deltaDepositedAmount: any;
  depositedAmount: any;
  depositedBDV: any;
  createdAt: any;
};

type SeasonToFarmerSiloAssetSnapshot = Record<number, FarmerSiloAssetSnapshot>;

export const useMergedFarmerSiloAssetSnapshotsQuery = (
  account: string | undefined
) => {
  const chainId = useChainId();
  const getToken = useGetChainAgnosticLegacyToken();

  const [execute] = useFarmerSiloAssetSnapshotsLazyQuery({
    variables: { account: account || '' },
    fetchPolicy: 'cache-and-network',
  });

  const query = useQuery({
    queryKey: [[chainId], queryKeys.farmerSiloAssetSnapshots(account)],
    queryFn: async () => {
      const output: Record<string, SeasonToFarmerSiloAssetSnapshot> = {};

      console.debug('[useMergedFarmerSiloAssetSnapshotsQuery] fetching...');

      const l2Result = await execute({
        context: { subgraph: 'beanstalk' },
      }).then((result) => result.data?.farmer?.silo?.assets ?? []);

      const l1Result = await execute({
        context: { subgraph: 'beanstalk_eth' },
      }).then((result) => result.data?.farmer?.silo?.assets ?? []);

      for (const siloAssetFragment of l2Result) {
        const token = getToken(siloAssetFragment.token);
        const map =
          siloAssetFragment.hourlySnapshots.reduce<SeasonToFarmerSiloAssetSnapshot>(
            (acc, curr) => {
              if (curr.season !== RESEED_SEASON - 1) {
                acc[curr.season] = curr as FarmerSiloAssetSnapshot;
              }
              return acc;
            },
            {}
          );

        output[getTokenIndex(token)] = { ...map };
      }

      for (const siloAssetFragment of l1Result) {
        const token = getToken(siloAssetFragment.token);
        const map = { ...(output[getTokenIndex(token)] || {}) };
        siloAssetFragment.hourlySnapshots.forEach((snapshot) => {
          map[snapshot.season] = snapshot as FarmerSiloAssetSnapshot;
        });
        output[getTokenIndex(token)] = map;
      }

      const assets = Object.entries(output).map(
        ([tokenAddress, snapshots]) => ({
          token: tokenAddress,
          // sort in ascending order
          hourlySnapshots: Object.values(snapshots).sort(
            (a, b) => a.season - b.season
          ),
        })
      );

      console.debug('[useMergedFarmerSiloAssetSnapshotsQuery] result', assets);

      return assets;
    },
    enabled: !!account,
    staleTime: 1000 * 60 * 20, // 20 mins
    refetchOnMount: true,
  });

  return query;
};

const useFarmerSiloHistory = (
  account: string | undefined,
  itemizeByToken: boolean = false,
  includeStalk: boolean = false
) => {
  const breakdown = useFarmerBalancesBreakdown();
  const siloRewardsQuery = useMergedFarmerSiloRewardsQuery(account);
  const siloAssetsQuery = useMergedFarmerSiloAssetSnapshotsQuery(account);

  const seedsPerTokenQuery = useWhitelistTokenRewardsQuery({
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk' },
  });

  const priceQuery = useSeasonsQuery<SeasonalInstantPriceQuery>(
    subgraphQueryConfigs.priceInstantBEAN.queryKey,
    {
      document: subgraphQueryConfigs.priceInstantBEAN.document,
      queryConfig: subgraphQueryConfigs.priceInstantBEAN.queryOptions,
    },
    null,
    SeasonRange.ALL,
    'both'
  );

  /// Interpolate
  const depositData = useInterpolateDeposits(
    siloAssetsQuery,
    priceQuery,
    itemizeByToken
  );

  const [stalkData, seedsData, grownStalkData] = useInterpolateStalk(
    siloRewardsQuery,
    seedsPerTokenQuery,
    !includeStalk
  );

  const withCurrSeasonDepositsData = useMemo(() => {
    if (!depositData.length) return depositData;
    const copy = [...depositData];

    const baseDataPoint = { ...copy[copy.length - 1] };
    baseDataPoint.value = breakdown.states.deposited.value.toNumber();
    if (itemizeByToken) {
      Object.entries(breakdown.states.deposited.byToken).forEach(
        ([tk, { value }]) => {
          if (tk in baseDataPoint) {
            baseDataPoint[tk] = value.toNumber();
          }
        }
      );
    }

    copy[copy.length - 1] = baseDataPoint;
    return copy;
  }, [
    breakdown.states.deposited.byToken,
    breakdown.states.deposited.value,
    itemizeByToken,
    depositData,
  ]);

  return {
    // remove the current season's data
    data: {
      deposits: withCurrSeasonDepositsData,
      stalk: stalkData,
      seeds: seedsData,
      grownStalk: grownStalkData,
    },
    loading:
      siloRewardsQuery.isLoading ||
      siloAssetsQuery.isLoading ||
      priceQuery.loading,
    // || breakdown hasn't loaded value yet
  };
};

export default useFarmerSiloHistory;
