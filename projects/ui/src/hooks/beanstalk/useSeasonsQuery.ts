import { useMemo } from 'react';
import {
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  QueryOptions,
  gql,
} from '@apollo/client';
import { apolloClient } from '~/graph/client';
import { useQuery } from '@tanstack/react-query';
import { RESEED_SEASON } from '~/constants';
import { DynamicSGQueryOption, SeasonsQueryFetchType } from '~/util/Graph';

const PAGE_SIZE = 1000;

const RESEED_SEASON_TIMESTAMP = 1728525600;

const INIT_SEASON_LTE = 999999999;

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

const baseL1Variables = {
  season_lte: RESEED_SEASON - 1,
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
  name: string,
  document: DocumentNode = gql`
    query MyQuery {
      _meta {
        hasIndexingErrors
      }
    }
  `,
  range: SeasonRange,
  queryConfig?: Partial<QueryOptions> | DynamicSGQueryOption,
  fetchType: SeasonsQueryFetchType = 'both'
) => {
  const queryOptions = {
    l2: deriveQueryConfig('l2', queryConfig, document),
    l1: deriveQueryConfig('l1', queryConfig, document),
  };

  const _range = range === SeasonRange.WEEK ? SeasonRange.MONTH : range;

  // prettier-ignore
  const query = useQuery({
    queryKey: [name, queryOptions, _range, fetchType],
    queryFn: async () => {
      console.debug(`[useSeasonsQuery] initializing with range = ${range}`);

      try {
        const output: Record<number, T['seasons'][number]> = {};
        const promises: Promise<void>[] = [];

        const fetchL2 = fetchType !== 'l1-only';
        const fetchL1 = fetchType !== 'l2-only';
        
        const reseedSeasonDiff = getNow2ReseedSeasonsDiff();
        
        const baseVariables: OperationVariables = {
          first: PAGE_SIZE,
          season_lte: INIT_SEASON_LTE,
        };
        const l2Config = mergeQueryOptions(queryOptions.l2, {
          variables: baseVariables,
        });
        const l1Config = mergeQueryOptions(queryOptions.l1, {
          variables: { ...baseVariables, ...baseL1Variables },
        });
        
        const pushPromise = (
          promise: Promise<ApolloQueryResult<MinimumViableSnapshotQuery>>,
          callback?: (data: MinimumViableSnapshot) => void
        ) => {
          const seasonPromise = promise.then((data) => {
            data.data?.seasons.forEach((seasonData) => {
              output[seasonData.season] = seasonData;
              callback?.(seasonData);
            });
          });
          promises.push(seasonPromise);
        };

        if (range !== SeasonRange.ALL) {
          const numSeasons = SEASON_RANGE_TO_COUNT[_range];
          if (l2Config.variables) { // should always be the truthy
            l2Config.variables.first = numSeasons;
          }

          if (fetchL2) {
            console.debug('[useSeasonsQuery] l2 config', l2Config);
            pushPromise(apolloClient.query(l2Config));
          }

          const l1Needed = numSeasons ? numSeasons > reseedSeasonDiff : true;

          if (fetchL1 && l1Needed) {
            console.debug('[useSeasonsQuery] l1 config', l1Config);
            pushPromise(apolloClient.query(l1Config));
          }
          await Promise.all(promises);
        } else {
          let latestL2 = 0; // latest L2 season
          let latestL1 = 0; // latest L1 season

          if (fetchL2) {
            console.debug('[useSeasonsQuery] run l2 config: ', l2Config);
            pushPromise(apolloClient.query(l2Config), (data) => {
              latestL2 = Math.max(latestL2, data.season);
            });
          }
          if (fetchL1) {
            console.debug('[useSeasonsQuery] run l1 config', l1Config);
            pushPromise(apolloClient.query(l1Config), (data) => {
              latestL1 = Math.max(latestL1, data.season);
            });
          }

          await Promise.all(promises);

          if (fetchL2) {
            const cachedL2Data = readApolloCacheWithOptions(l2Config, {
              season_lte: latestL1,
              season_gt: RESEED_SEASON - 1,
            });
            cachedL2Data?.seasons.forEach((seasonData) => {
              output[seasonData.season] = seasonData;
              latestL2 = Math.max(Math.min(latestL2, seasonData.season), 0);
            });

            const numQueries = calcNumQueries(latestL2, RESEED_SEASON - 1);
            console.debug('[useSeasonsQuery]: l2 numQueries', numQueries);

            /// Query Seasons from network
            for (const fetchData of getQueriesWithNumQueries(numQueries, latestL1, l1Config)) {
              pushPromise(fetchData());
            }
          }

          if (fetchL1) {
            const cachedL1Data = readApolloCacheWithOptions(l1Config, {
              season_lte: RESEED_SEASON - 1,
              season_gt: 1,
            });
            cachedL1Data?.seasons.forEach((seasonData) => {
              output[seasonData.season] = seasonData;
              latestL1 = Math.max(Math.min(latestL1, seasonData.season), 0);
            });

            const numQueries = calcNumQueries(latestL1, l1Config.variables?.season_gt ?? 1);
            console.debug(
              `[useSeasonsQuery] numQueries = ${numQueries}, seasonsQueryFrom = ${latestL1} `
            );

            /// Query Seasons from network
            const queries = getQueriesWithNumQueries(numQueries, latestL1, l1Config);
            for (const fetchData of queries) {
              pushPromise(fetchData());
            }

            await Promise.all(promises);
          }
        }

        const seasonData = Object.values(output).sort(sortSeasonOutputDesc);

        console.debug('[useSeasonsQuery]: RESULT', name, seasonData);
        return seasonData;
      } catch (e) {
        console.error('e: ', e);
        return [] as T['seasons'][number][];
      }
    },
    select: (data) => {
      if (range !== SeasonRange.ALL) {
        const sliced = data.slice(0, SEASON_RANGE_TO_COUNT[range]);
        return sliced;
      }
      return data;
    },
    staleTime: 1000 * 5, // 5 seconds
    // staleTime: 1000 * 60 * 20, // 20 minutes
  });

  return useMemo(
    () => ({
      ...query,
      error: query.error ?? undefined,
      data: { seasons: query.data ?? [] },
      loading: query.isLoading,
    }),
    [query]
  );
};

export default useSeasonsQuery;

// ---------- Helper Functions ----------

function readApolloCacheWithOptions<T extends MinimumViableSnapshotQuery>(
  baseConfig: QueryOptions<OperationVariables, T>,
  variables: OperationVariables
) {
  const options = mergeQueryOptions(baseConfig, {
    variables: {
      ...variables,
      first: 100_000,
    },
    fetchPolicy: 'cache-only',
  });

  const data = apolloClient.readQuery(options);
  console.debug('[useSeasonsQuery] cache', { options, data });

  return data;
}

function getQueriesWithNumQueries<T extends MinimumViableSnapshotQuery>(
  numQueries: number,
  latestSeason: number,
  config: QueryOptions<OperationVariables, T>
) {
  const queriesAndOptions: (() => Promise<
    ApolloQueryResult<MinimumViableSnapshotQuery>
  >)[] = [];
  for (let i = 0; i < numQueries; i += 1) {
    const season = Math.max(0, latestSeason - i * PAGE_SIZE);

    const options = mergeQueryOptions(config, {
      variables: {
        first: season < 1000 ? season - 1 : 1000,
        season_lte: season,
      },
    });

    const seasonGt = Math.max(0, season - PAGE_SIZE);
    mergeVariableIfExists(options, 'season_gt', seasonGt);
    mergeVariableIfExists(options, 'season_gte', seasonGt - 1);

    console.debug('[getQueriesWithNumQueries] options', i, options);
    queriesAndOptions.push(() => apolloClient.query(options));
  }

  return queriesAndOptions;
}

function calcNumQueries(upper: number, lower: number) {
  return Math.ceil((upper - lower) / PAGE_SIZE);
}

function getNow2ReseedSeasonsDiff() {
  const now = Math.floor(new Date().getTime() / 1000);
  const secondsDiff = now - RESEED_SEASON_TIMESTAMP;

  return Math.floor(secondsDiff / 60 / 60);
}

function sortSeasonOutputDesc<T extends MinimumViableSnapshot>(a: T, b: T) {
  if (!a.season) return 1;
  if (!b.season) return -1;
  return b.season - a.season;
}

function isFunction(fn: unknown): fn is Function {
  return typeof fn === 'function';
}

function deriveQueryConfig<T extends MinimumViableSnapshotQuery>(
  chain: 'l1' | 'l2',
  queryConfig: Partial<QueryOptions> | DynamicSGQueryOption | undefined,
  document: DocumentNode
): QueryOptions<OperationVariables, T> {
  const config =
    (isFunction(queryConfig) ? queryConfig(chain) : queryConfig) ?? {};
  let subgraph: string = config.context?.subgraph;

  if (chain === 'l2') {
    if (!subgraph || subgraph === 'beanstalk_eth') {
      subgraph = 'beanstalk';
    } else if (subgraph === 'bean_eth') {
      subgraph = 'bean';
    }
  } else if (chain === 'l1') {
    if (!subgraph || subgraph === 'beanstalk') {
      subgraph = 'beanstalk_eth';
    } else if (subgraph === 'bean') {
      subgraph = 'bean_eth';
    }
  }

  return {
    ...config,
    notifyOnNetworkStatusChange: true,
    variables: config.variables ?? {},
    context: { subgraph },
    query: document,
    fetchPolicy: 'network-only',
  };
}

function mergeQueryOptions<T extends MinimumViableSnapshotQuery>(
  a: QueryOptions<OperationVariables, T>,
  b: Partial<QueryOptions<OperationVariables, T>>
): QueryOptions<OperationVariables, T> {
  return {
    ...a,
    ...b,
    variables: {
      ...a.variables,
      ...b.variables,
    },
    context: {
      ...a.context,
      ...b.context,
    },
  };
}

function mergeVariableIfExists<T extends MinimumViableSnapshotQuery>(
  options: QueryOptions<OperationVariables, T>,
  key: string,
  value: any
) {
  if (!options.variables) return options;
  if (key in options.variables) {
    options.variables[key] = value;
  }
  return options;
}
