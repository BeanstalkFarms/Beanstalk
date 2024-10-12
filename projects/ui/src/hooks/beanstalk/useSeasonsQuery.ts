import { useEffect, useMemo, useState } from 'react';
import {
  DocumentNode,
  LazyQueryHookExecOptions,
  OperationVariables,
  QueryOptions,
  gql,
  useLazyQuery,
} from '@apollo/client';
import { apolloClient } from '~/graph/client';
import { RESEED_SEASON } from '~/constants';

const PAGE_SIZE = 1000;

const SEASON_IN_MONTH = 720;

export enum SeasonAggregation {
  HOUR = 0,
  DAY,
}

export enum SeasonRange {
  WEEK = 0,
  MONTH = 1,
  ALL = 2,
}

export const SEASON_RANGE_TO_COUNT: {
  [key in SeasonRange]: number | undefined;
} = {
  [SeasonRange.WEEK]: 168, // 7*24
  [SeasonRange.MONTH]: 672, // 28*24
  [SeasonRange.ALL]: undefined,
} as const;

/**
 * The minimum data points that each Snapshot should acquire.
 */
export type MinimumViableSnapshot = {
  id: string;
  season: number;
  timestamp: string;
};

/**
 * Query data containing an array of Snapshots.
 */
export type MinimumViableSnapshotQuery = {
  seasons: (MinimumViableSnapshot & any)[];
};

/**
 * Extracts a single data point from an array of Snapshots.
 */
export type SnapshotData<T extends MinimumViableSnapshotQuery> =
  T['seasons'][number];

export type SeasonsQueryDynamicConfig = (
  subgraph: 'l1' | 'l2'
) => Partial<QueryOptions>;

const getEthSubgraphConfig = <T extends MinimumViableSnapshotQuery>(
  config: LazyQueryHookExecOptions<T, OperationVariables>
): LazyQueryHookExecOptions<T, OperationVariables> => {
  const subgraph = config.context?.subgraph ?? 'beanstalk';
  const ethSubgraph = subgraph === 'beanstalk' ? 'beanstalk_eth' : 'bean_eth';

  const _config = {
    ...config,
    context: {
      ...config.context,
      subgraph: ethSubgraph,
    },
  };
  return _config;
};

/**
 * Iteratively query entities that have a `season` entity.
 * This allows for loading of full datasets when the user
 * requests to see "all" data for a given chart. Assumes that
 * the subgraph contains 1 entity per Season starting at Season 1.
 *
 * @param document an arbitrary graphql query document with a `seasons` entity
 * @param range
 * @returns QueryDocument
 */
const useSeasonsQuery = <T extends MinimumViableSnapshotQuery>(
  document: DocumentNode = gql`
    query MyQuery {
      _meta {
        hasIndexingErrors
      }
    }
  `,
  range: SeasonRange,
  queryConfig?: Partial<QueryOptions> | SeasonsQueryDynamicConfig,
  fetchType: 'l1-only' | 'l2-only' | 'both' = 'both',
  name?: string
) => {
  /// Custom loading prop
  const [loading, setLoading] = useState(false);

  const initConfig = useMemo(() => {
    const _queryConfig =
      (typeof queryConfig === 'function' ? queryConfig('l2') : queryConfig) ??
      {};

    const config: LazyQueryHookExecOptions<T, OperationVariables> = {
      ..._queryConfig,
      variables: _queryConfig.variables ?? {},
      fetchPolicy: 'cache-and-network',
      context: {
        subgraph: _queryConfig.context?.subgraph ?? 'beanstalk',
      },
    };
    return config;
  }, [queryConfig]);

  /// Execute generic lazy query
  const [get, query] = useLazyQuery<T>(document, initConfig);

  /// Output used when user requests all data
  const [allSeasonsOutput, setAllSeasonsOutput] = useState<any[]>([]);

  useEffect(() => {
    const fetchL2 = fetchType !== 'l1-only';
    const fetchL1 = fetchType !== 'l2-only';

    (async () => {
      console.debug(`[useSeasonsQuery] initializing with range = ${range}`);
      try {
        if (range !== SeasonRange.ALL) {
          // data.seasons is sorted by season, descending.
          const variables = {
            ...initConfig?.variables,
            first: SEASON_RANGE_TO_COUNT[range],
            season_lte: 999999999,
            season_gte: RESEED_SEASON,
          };
          console.debug('[useSeasonsQuery] run', { variables });
          const config: LazyQueryHookExecOptions<T, OperationVariables> = {
            ...initConfig,
            variables,
            fetchPolicy: 'cache-and-network',
          };
          let data;
          if (fetchL2) {
            data = await get(config).catch((e) => {
              console.error(e);
              return { data: { seasons: [] } };
            });
          } else {
            data = { data: { seasons: [] } };
          }

          if (
            !data.data ||
            (data?.data?.seasons?.length < SEASON_IN_MONTH && fetchL1)
          ) {
            const _config =
              typeof queryConfig === 'function'
                ? queryConfig('l1')
                : getEthSubgraphConfig(config);
            // Try x_eth subgraph if not enough data is available. Apollo will auto merge
            await get({
              ..._config,
              variables: {
                ...config.variables,
                ..._config.variables,
                season_lte: RESEED_SEASON - 1,
                season_gte: 0,
              },
            });
          }
        } else {
          // Initialize Season data with a call to the first set of Seasons.
          const variables = {
            ...initConfig?.variables,
            first: undefined,
            season_lte: 999999999,
          };
          console.debug('[useSeasonsQuery] run', { variables });
          const config: LazyQueryHookExecOptions<T, OperationVariables> = {
            ...queryConfig,
            variables,
          };

          let data;

          if (fetchL2) {
            data = await get(config).catch((e) => {
              console.error(e);
              return { data: { seasons: [] } };
            });
          } else {
            data = { data: { seasons: [] } };
          }

          console.debug('[useSeasonsQuery] init: data = ', data.data);
          const _l1Config =
            typeof queryConfig === 'function'
              ? queryConfig('l2')
              : getEthSubgraphConfig(config);
          const l1Config: any = {
            ..._l1Config,
            variables: {
              ...variables,
              ..._l1Config.variables,
              season_lte: RESEED_SEASON,
            },
          };

          const init = await get(l1Config);

          if (!init.data) {
            console.error(init);
            throw new Error('missing data');
          }

          /**
           * the newest season indexed by the subgraph
           * data is returned sorted from oldest to newest
           * so season 0 is the oldest season and length-1 is newest.
           */
          const latestSubgraphSeason = init.data.seasons[0].season;

          console.debug(
            `[useSeasonsQuery] requested all seasons. current season is ${latestSubgraphSeason}. oldest loaded season ${
              init.data.seasons[init.data.seasons.length - 1].season
            }`,
            init.data.seasons,
            queryConfig
          );

          /**
           * 3000 / 1000 = 3 queries
           * Season    1 - 1000
           *        1001 - 2000
           *        2001 - 3000
           */
          const numQueries = Math.ceil(
            /// If `season_gt` is provided, we only query back to that season.
            (latestSubgraphSeason - (l1Config?.variables?.season_gt || 0)) /
              PAGE_SIZE
          );
          const promises = [];
          console.debug(
            `[useSeasonsQuery] needs ${numQueries} calls to get ${latestSubgraphSeason} more seasons`
          );
          setLoading(true);
          const output: any[] = [];
          for (let i = 0; i < numQueries; i += 1) {
            const season = Math.max(
              0, // always at least 0
              latestSubgraphSeason - i * PAGE_SIZE
            );
            const thisVariables = {
              ...l1Config?.variables,
              first: season < 1000 ? season - 1 : 1000,
              season_lte: season,
            };
            promises.push(
              apolloClient
                .query({
                  ...l1Config,
                  query: document,
                  variables: thisVariables,
                  notifyOnNetworkStatusChange: true,
                })
                .then((r) => {
                  console.debug(
                    `[useSeasonsQuery] get: ${season} -> ${Math.max(
                      season - 1000,
                      1
                    )} =`,
                    r.data,
                    { variables: thisVariables, document }
                  );
                  r.data.seasons.forEach((seasonData: any) => {
                    output[seasonData.season] = seasonData;
                  });
                })
            );
          }

          /**
           * Wait for queries to complete
           */
          await Promise.all(promises);
          setAllSeasonsOutput(output.filter(Boolean).reverse());
          setLoading(false);
        }
      } catch (e) {
        console.debug('[useSeasonsQuery] failed');
        console.error(e);
      }
    })();
  }, [range, get, document, initConfig, queryConfig, fetchType]);

  if (range === SeasonRange.ALL) {
    return {
      ...query,
      data: { seasons: allSeasonsOutput },
      loading: loading || query.loading,
    };
  }

  return {
    ...query,
    loading: loading || query.loading,
  };
};

export default useSeasonsQuery;
