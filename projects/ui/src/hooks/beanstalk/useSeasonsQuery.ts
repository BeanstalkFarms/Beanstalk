import { useMemo } from 'react';
import {
  DocumentNode,
  OperationVariables,
  QueryOptions,
  gql,
} from '@apollo/client';
import { apolloClient } from '~/graph/client';
import { useQuery } from '@tanstack/react-query';
import { RESEED_SEASON } from '~/constants';

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

export type SeasonsQueryDynamicConfig = (
  subgraph: 'l1' | 'l2'
) => Partial<QueryOptions>;

const baseL1Variables = {
  season_lte: RESEED_SEASON - 1,
  // season_gt: 1,
};

type SeasonsQueryFetchType = 'l1-only' | 'l2-only' | 'both';

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
  queryConfig?: Partial<QueryOptions> | SeasonsQueryDynamicConfig,
  fetchType: SeasonsQueryFetchType = 'both'
) => {
  const queryOptions = {
    l2: deriveQueryConfig('l2', queryConfig, document),
    l1: deriveQueryConfig('l1', queryConfig, document),
  };

  const _range = range === SeasonRange.WEEK ? SeasonRange.MONTH : range;

  const query = useQuery({
    queryKey: [name, queryOptions, _range, fetchType],
    queryFn: async () => {
      console.debug(`[useSeasonsQuery] initializing with range = ${range}`);

      try {
        const output: Record<number, T['seasons'][number]> = {};
        const promises = [];

        const fetchL2 = fetchType !== 'l1-only';
        const fetchL1 = fetchType !== 'l2-only';

        const reseedSeasonDiff = getNow2ReseedSeasonsDiff();

        const baseVariables: OperationVariables = {
          first: PAGE_SIZE,
          season_lte: INIT_SEASON_LTE,
        };

        if (range !== SeasonRange.ALL) {
          const numSeasons = SEASON_RANGE_TO_COUNT[_range];
          baseVariables.first = numSeasons;
          const l2Config = shallowMergeQueryConfigs(queryOptions.l2, {
            variables: baseVariables,
            fetchPolicy: 'network-only',
          });
          const l1Config = shallowMergeQueryConfigs(queryOptions.l1, {
            variables: {
              ...baseVariables,
              ...baseL1Variables,
            },
            fetchPolicy: 'network-only',
          });

          if (fetchL2) {
            console.debug('[useSeasonsQuery] run l2', {
              variables: l2Config.variables ?? {},
            });
            const l2Query = apolloClient.query(l2Config).then((l2Data) => {
              l2Data.data?.seasons.forEach((seasonData) => {
                output[seasonData.season] = seasonData;
              });
            });
            promises.push(l2Query);
          }
          const l1Needed = numSeasons ? numSeasons > reseedSeasonDiff : true;

          if (fetchL1 && l1Needed) {
            console.debug('[useSeasonsQuery] run l1', {
              variables: l1Config.variables ?? {},
            });
            const l1Query = apolloClient.query(l1Config).then((l1Data) => {
              l1Data?.data?.seasons.forEach((seasonData) => {
                output[seasonData.season] = seasonData;
              });
            });
            promises.push(l1Query);
          }
          await Promise.all(promises);
        } else {
          const initPromises = [];
          const l2Config = shallowMergeQueryConfigs(queryOptions.l2, {
            variables: baseVariables,
          });
          const l1Config = shallowMergeQueryConfigs(queryOptions.l1, {
            variables: {
              ...baseVariables,
              ...baseL1Variables,
            },
            fetchPolicy: 'cache-first',
          });
          let latestL2 = 0;
          let latestL1 = 0;

          if (fetchL2) {
            console.debug('[useSeasonsQuery] run l2', {
              variables: l2Config.variables ?? {},
            });
            const l2Init = apolloClient.query(l2Config).then((l2Data) => {
              l2Data.data?.seasons.forEach((seasonData) => {
                latestL2 = Math.max(latestL2, seasonData.season);
                output[seasonData.season] = seasonData;
              });
            });
            initPromises.push(l2Init);
          }
          if (fetchL1) {
            console.debug('[useSeasonsQuery] run l2', {
              variables: l2Config.variables ?? {},
            });
            const l1Init = apolloClient.query(l1Config).then((l1Data) => {
              l1Data.data?.seasons.forEach((seasonData) => {
                latestL1 = Math.max(latestL1, seasonData.season);
                output[seasonData.season] = seasonData;
              });
            });
            promises.push(l1Init);
          }
          await Promise.all(initPromises);

          /**
           * If LatestSeason in L2 queries is 5000, and reseed season is 3500,
           * seasons to query: 1500.
           * Ceil(1500 / 1000) = 2 queries
           *
           * If Latest season in L2 queries is 4000, and reseed season is 3500,
           * seasons to query: 500
           * Ceil(500 / 1000) = 1 query. Since we have already queried these seasons, we skip.
           */
          const numQueriesL2 = fetchL2
            ? calcNumQueries(latestL2, RESEED_SEASON - 1)
            : 0;

          for (let i = 0; i < numQueriesL2; i += 1) {
            const season = Math.max(
              0, // always at least 0
              latestL2 - i * PAGE_SIZE
            );
            const thisConfig = shallowMergeQueryConfigs(l2Config, {
              variables: {
                first: season < 1000 ? season - 1 : 1000,
                season_lte: season,
              },
            });
            console.debug('[useSeasonsQuery] run l2', {
              variables: thisConfig.variables ?? {},
            });
            promises.push(
              apolloClient.query(thisConfig).then((l2Data) => {
                l2Data.data?.seasons.forEach((seasonData) => {
                  output[seasonData.season] = seasonData;
                });
              })
            );
          }

          if (fetchL1) {
            const numQueries = calcNumQueries(
              latestL1,
              l1Config.variables?.season_gt || 1
            );

            for (let i = 0; i < numQueries; i += 1) {
              const season = Math.max(
                0, // always at least 0
                latestL1 - i * PAGE_SIZE
              );
              const thisConfig = shallowMergeQueryConfigs(l1Config, {
                variables: {
                  first: season < 1000 ? season - 1 : 1000,
                  season_lte: season,
                  season_gt: Math.max(0, season - PAGE_SIZE),
                },
                // fetchPolicy: 'network-only',
              });
              console.log('[useSeasonsQuery] run l1', i, {
                variables: thisConfig.variables ?? {},
              });
              promises.push(
                apolloClient.query(thisConfig).then((l1Data) => {
                  l1Data.data?.seasons.forEach((seasonData) => {
                    output[seasonData.season] = seasonData;
                  });
                })
              );
            }
          }
        }

        await Promise.all(promises);
        const seasonData = Object.values(output).sort(sortSeasonOutputDesc);
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
    staleTime: 1000 * 60 * 20, // 20 minutes
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

function deriveQueryConfig(
  chain: 'l1' | 'l2',
  queryConfig: Partial<QueryOptions> | SeasonsQueryDynamicConfig | undefined,
  document: DocumentNode
) {
  const config =
    (isFunction(queryConfig) ? queryConfig(chain) : queryConfig) ?? {};
  let subgraph: string = config.context?.subgraph || 'beanstalk';

  if (chain === 'l2') {
    subgraph = subgraph === 'beanstalk' ? 'beanstalk' : 'bean';
  } else if (chain === 'l1') {
    subgraph = subgraph === 'beanstalk' ? 'beanstalk_eth' : 'bean_eth';
  }

  return {
    ...config,
    notifyOnNetworkStatusChange: true,
    variables: config.variables ?? {},
    context: { subgraph },
    query: document,
  };
}

function shallowMergeQueryConfigs<T extends MinimumViableSnapshotQuery>(
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

// Execute generic lazy query
// const [get, query] = useLazyQuery<T>(document, queryOptions);

/// Output used when user requests all data

// useEffect(() => {
//   const fetchL2 = fetchType !== 'l1-only';
//   const fetchL1 = fetchType !== 'l2-only';

//   (async () => {
//     console.debug(`[useSeasonsQuery] initializing with range = ${range}`);
//     const seasonOutput: Record<number, MinimumViableSnapshot> = {};

//     try {
//       setLoading(true);
//       if (range !== SeasonRange.ALL) {
//         // data.seasons is sorted by season, descending.
//         const variables: OperationVariables = {
//           ...initConfig?.variables,
//           first: SEASON_RANGE_TO_COUNT[range],
//           season_lte: 999999999,
//           season_gt: RESEED_SEASON,
//         };
//         console.debug('[useSeasonsQuery] run', { variables });

//         const config: LazyQueryHookExecOptions<T, OperationVariables> = {
//           ...initConfig,
//           fetchPolicy: 'cache-and-network',
//           variables,
//         };

//         if (fetchL2) {
//           await get(config)
//             .catch((e) => {
//               console.error(e);
//               return { data: { seasons: [] } };
//             })
//             .then((response) => {
//               response.data?.seasons.forEach((seasonData) => {
//                 seasonOutput[seasonData.season] = seasonData;
//               });
//             });
//         }

//         if (fetchL1) {
//           const l1Config = isFunction(queryConfig)
//             ? queryConfig('l1')
//             : getEthSubgraphConfig(config);
//           // Try x_eth subgraph if not enough data is available. Apollo will auto merge
//           await get({
//             ...l1Config,
//             variables: {
//               ...config.variables,
//               ...l1Config.variables,
//               season_lte: RESEED_SEASON - 1,
//               season_gt: 0,
//             },
//           }).then((response) => {
//             response.data?.seasons.forEach((seasonData) => {
//               seasonOutput[seasonData.season] = seasonData;
//             });
//           });
//         }
//         setSeasonsOutput(
//           Object.values(seasonOutput).sort(sortSeasonOutputDesc)
//         );
//       } else {
//         // Initialize Season data with a call to the first set of Seasons.
//         const variables = {
//           ...initConfig?.variables,
//           first: undefined,
//           season_lte: 999999999,
//         };

//         console.debug('[useSeasonsQuery] run', { variables });

//         const config = {
//           ...initConfig,
//           variables,
//         };

//         let earliestSeason = variables.season_lte as number;
//         const season_gte = RESEED_SEASON;

//         if (fetchL2) {
//           const initL2Data = await get(config).catch((e) => {
//             console.error(e);
//             return { data: { seasons: [] } };
//           });

//           initL2Data.data?.seasons.forEach((seasonData) => {
//             if (earliestSeason > (seasonData.season as number)) {
//               earliestSeason = seasonData.season;
//             }
//             seasonOutput[seasonData.season] = seasonData;
//           });

//           if (earliestSeason > RESEED_SEASON) {
//             const l2Promises = [];
//             const numQueries = Math.ceil(
//               (earliestSeason - RESEED_SEASON) / PAGE_SIZE
//             );

//             for (let i = 0; i < numQueries; i += 1) {
//               const season_lte = Math.max(
//                 0, // always at least 0
//                 earliestSeason - i * PAGE_SIZE
//               );
//               const thisVariables = {
//                 ...initConfig?.variables,
//                 first: season_lte < 1000 ? season_lte - 1 : 1000,
//                 season_lte: season_lte,
//               };

//               l2Promises.push(
//                 apolloClient
//                   .query({
//                     ...config,
//                     query: document,
//                     variables: thisVariables,
//                     notifyOnNetworkStatusChange: true,
//                   })
//                   .then((response) => {
//                     response.data?.seasons.forEach((seasonData) => {
//                       seasonOutput[seasonData.season] = seasonData;
//                     });
//                   })
//               );
//             }
//           }
//         }

//         console.debug('[useSeasonsQuery] init: data = ', data.data);
//         const _l1Config =
//           typeof queryConfig === 'function'
//             ? queryConfig('l2')
//             : getEthSubgraphConfig(config);
//         const l1Config: any = {
//           ..._l1Config,
//           variables: {
//             ...variables,
//             ..._l1Config.variables,
//             season_lte: RESEED_SEASON,
//           },
//         };

//         const init = await get(l1Config);

//         if (!init.data) {
//           console.error(init);
//           throw new Error('missing data');
//         }

//         /**
//          * the newest season indexed by the subgraph
//          * data is returned sorted from oldest to newest
//          * so season 0 is the oldest season and length-1 is newest.
//          */
//         const latestSubgraphSeason = init.data.seasons[0].season;

//         console.debug(
//           `[useSeasonsQuery] requested all seasons. current season is ${latestSubgraphSeason}. oldest loaded season ${
//             init.data.seasons[init.data.seasons.length - 1].season
//           }`,
//           init.data.seasons,
//           queryConfig
//         );

//         /**
//          * 3000 / 1000 = 3 queries
//          * Season    1 - 1000
//          *        1001 - 2000
//          *        2001 - 3000
//          */
//         const numQueries = Math.ceil(
//           /// If `season_gt` is provided, we only query back to that season.
//           (latestSubgraphSeason - (l1Config?.variables?.season_gt || 0)) /
//             PAGE_SIZE
//         );
//         const promises = [];
//         console.debug(
//           `[useSeasonsQuery] needs ${numQueries} calls to get ${latestSubgraphSeason} more seasons`
//         );
//         const output: any[] = [];
//         for (let i = 0; i < numQueries; i += 1) {
//           const season = Math.max(
//             0, // always at least 0
//             latestSubgraphSeason - i * PAGE_SIZE
//           );
//           const thisVariables = {
//             ...l1Config?.variables,
//             first: season < 1000 ? season - 1 : 1000,
//             season_lte: season,
//           };
//           promises.push(
//             apolloClient
//               .query({
//                 ...l1Config,
//                 query: document,
//                 variables: thisVariables,
//                 notifyOnNetworkStatusChange: true,
//               })
//               .then((r) => {
//                 console.debug(
//                   `[useSeasonsQuery] get: ${season} -> ${Math.max(
//                     season - 1000,
//                     1
//                   )} =`,
//                   r.data,
//                   { variables: thisVariables, document }
//                 );
//                 r.data.seasons.forEach((seasonData: any) => {
//                   output[seasonData.season] = seasonData;
//                 });
//               })
//           );
//         }

//         /**
//          * Wait for queries to complete
//          */
//         await Promise.all(promises);
//         setSeasonsOutput(output.filter(Boolean).reverse());
//       }
//     } catch (e) {
//       console.debug('[useSeasonsQuery] failed');
//       console.error(e);
//     } finally {
//       setLoading(false);
//     }
//   })();
// }, [range, get, document, initConfig, queryConfig, fetchType, name]);
