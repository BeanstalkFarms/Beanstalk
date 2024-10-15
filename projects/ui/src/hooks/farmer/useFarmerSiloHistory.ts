import { useMemo } from 'react';
import {
  SeasonalInstantPriceDocument,
  useFarmerSiloAssetSnapshotsLazyQuery,
  useFarmerSiloAssetSnapshotsQuery,
  useFarmerSiloRewardsLazyQuery,
  useWhitelistTokenRewardsQuery,
} from '~/generated/graphql';
import useSeasonsQuery, {
  SeasonRange,
} from '~/hooks/beanstalk/useSeasonsQuery';
import useInterpolateDeposits from '~/hooks/farmer/useInterpolateDeposits';
import useInterpolateStalk from '~/hooks/farmer/useInterpolateStalk';
import { useQuery } from '@tanstack/react-query';
import useFarmerBalancesBreakdown from './useFarmerBalancesBreakdown';
import useChainId from '../chain/useChainId';

// type K = Exact<T extends { [key: string]: unknown; }> = { [K in keyof T]: T[K]; }

// const useMergedApolloQuery = <
//   TQuery extends {},
//   TVars extends { [key: string]: unknown },
//   TReturn
// >(props: {
//   queryKey: string[];
//   apolloLazyFetch: LazyQueryExecFunction<TQuery, Exact<TVars>>;
//   dataKey: string;
//   subgraph: 'beanstalk' | 'bean';
//   enabled: boolean;
// }) => {
//   const chainId = useChainId();

//   const mergedQuery = useQuery({
//     queryKey: [[chainId], ...props.queryKey],
//     queryFn: async () => {
//       const l1 = await props.apolloLazyFetch({
//         context: { subgraph: `${props.subgraph}_eth` },
//       });
//       const l2 = await props.apolloLazyFetch({
//         context: { subgraph: props.subgraph },
//       });

//       const l1Data = (l1.data?.[props.dataKey as keyof typeof l1.data] ??
//         []) as TQuery[keyof TQuery][];
//       const l2Data = (l2.data?.[props.dataKey as keyof typeof l2.data] ??
//         []) as TQuery[keyof TQuery][];

//       return [...l1Data, ...l2Data];
//     },
//     enabled: props.enabled,
//     staleTime: 1000 * 60 * 60, // 1 hour
//   });

//   return {
//     ...query,
//     data: query.data ? { [props.dataKey]: query.data } : undefined,
//     loading: query.isLoading,
//   } as TReturn;
// };

const useMergedFarmerSiloRewardsQuery = (account: string | undefined) => {
  const chainId = useChainId();
  const [fetch, query] = useFarmerSiloRewardsLazyQuery({
    variables: { account: account || '' },
    fetchPolicy: 'cache-and-network',
  });

  const mergedQuery = useQuery({
    queryKey: [[chainId], 'farmerSiloRewards', account],
    queryFn: async () => {
      const l1 = await fetch({
        context: { subgraph: 'beanstalk_eth' },
      });
      const l2 = await fetch({
        context: { subgraph: 'beanstalk' },
      });

      return [...(l1.data?.snapshots ?? []), ...(l2.data?.snapshots ?? [])];
    },
    enabled: !!account,
    staleTime: 1000 * 60 * 20, // 20 mins
  });

  return {
    ...query,
    loading: mergedQuery.isLoading,
    data: mergedQuery.data ? { snapshots: mergedQuery.data } : undefined,
  };
};

const useMergedFarmerSiloAssetSnapshotsQuery = (
  account: string | undefined
) => {
  const chainId = useChainId();
  const [fetch, query] = useFarmerSiloAssetSnapshotsLazyQuery({
    variables: { account: account || '' },
    fetchPolicy: 'cache-and-network',
  });

  const mergedQuery = useQuery({
    queryKey: [[chainId], 'farmerSiloAssetSnapshots', account],
    queryFn: async () => {
      const l1 = await fetch({
        context: { subgraph: 'beanstalk_eth' },
      });
      const l2 = await fetch({
        context: { subgraph: 'beanstalk' },
      });

      return [
        ...(l1.data?.farmer?.silo?.assets ?? []),
        ...(l2.data?.farmer?.silo?.assets ?? []),
      ];
    },
    select: (data) => {
      if (!data) return undefined;
      return {
        farmer: {
          silo: {
            assets: data,
          },
        },
      };
    },
    enabled: !!account,
    staleTime: 1000 * 60 * 20, // 20 mins
  });

  return {
    ...query,
    loading: mergedQuery.isLoading,
    data: mergedQuery.data,
  } as typeof query;
};

const useFarmerSiloHistory = (
  account: string | undefined,
  itemizeByToken: boolean = false,
  includeStalk: boolean = false
) => {
  const breakdown = useFarmerBalancesBreakdown();
  const siloRewardsQuery = useMergedFarmerSiloRewardsQuery(account);

  const siloAssetsQuery = useFarmerSiloAssetSnapshotsQuery({
    variables: { account: account || '' },
    skip: !account,
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk_eth' },
  });
  const seedsPerTokenQuery = useWhitelistTokenRewardsQuery({
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk_eth' },
  });

  const queryConfig = useMemo(
    () => ({
      variables: { season_gte: 1 },
      context: { subgraph: 'bean' },
    }),
    []
  );

  const priceQuery = useSeasonsQuery(
    SeasonalInstantPriceDocument,
    SeasonRange.ALL,
    queryConfig,
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

  // console.log('salkData', stalkData);

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
      siloRewardsQuery.loading || siloAssetsQuery.loading || priceQuery.loading,
    // || breakdown hasn't loaded value yet
  };
};

export default useFarmerSiloHistory;
