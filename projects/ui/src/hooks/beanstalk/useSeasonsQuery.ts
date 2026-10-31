import { useMemo } from 'react';
import {
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  QueryOptions,
} from '@apollo/client';
import { apolloClient } from '~/graph/client';
import { useQuery } from '@tanstack/react-query';
import { RESEED_SEASON } from '~/constants';
import { DynamicSGQueryOption, SeasonsQueryFetchType } from '~/util/Graph';
import { fetchApolloWithLimiter } from '~/util/Bottleneck';

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

export type SeasonsQueryConfig = {
  document: DocumentNode;
  queryConfig?: Partial<QueryOptions> | DynamicSGQueryOption;
  where?: string;
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
  config: SeasonsQueryConfig,
  cachedConfig: SeasonsQueryConfig | null,
  range: SeasonRange,
  fetchType: SeasonsQueryFetchType = 'both',
  enabled = true
) => {
  const { document, queryConfig } = config;
  const queryOptions = {
    l2: deriveQueryConfig('l2', queryConfig, document),
    l1: deriveQueryConfig('l1', queryConfig, document),
  };

  const _range = range === SeasonRange.WEEK ? SeasonRange.MONTH : range;

  // prettier-ignore
  const query = useQuery({
    enabled,
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
              const seasonNum = getSeasonNumber(seasonData);
              if (!Number.isNaN(seasonNum)) {
                output[seasonNum] = { ...seasonData, season: seasonNum };
                callback?.({ ...seasonData, season: seasonNum });
              }
            });
          });
          promises.push(seasonPromise);
        };

        if (range !== SeasonRange.ALL) {
          const numSeasons = SEASON_RANGE_TO_COUNT[_range];
          if (l2Config.variables) {
            // should always be the truthy
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
          let cacheLoaded = false;
          if (cachedConfig) {
            try {
              const [result] = await fetchApolloWithLimiter([{
                id: `${name}-${cachedConfig.where}-all`,
                request: () => apolloClient.query<MinimumViableSnapshotQuery>({
                  context: { subgraph: 'cache' },
                  query: cachedConfig.document,
                  variables: { where: cachedConfig.where ?? '' },
                  fetchPolicy: 'network-only',
                }),
              }]);
              if (!result?.data?.seasons) throw new Error('History cache returned no data');
              result.data.seasons.forEach((sd) => {
                const seasonNum = getSeasonNumber(sd);
                if (Number.isFinite(seasonNum)) output[seasonNum] = { ...sd, season: seasonNum };
              });
              cacheLoaded = true;
            } catch (error) {
              console.warn('[useSeasonsQuery] history cache unavailable; using subgraph', error);
            }
          }

          if (!cacheLoaded) {
            // Advance each chain independently using the oldest returned season.
            // A sequential cursor also handles sparse histories without skipping pages.
            const fetchHistory = async (options: QueryOptions, lower: number) => {
              let cursor = Number(options.variables?.season_lte ?? INIT_SEASON_LTE);
              while (cursor >= lower) {
                const [result] = await fetchApolloWithLimiter([{
                  id: `${name}-${options.context?.subgraph}-${cursor}`,
                  request: () => apolloClient.query<MinimumViableSnapshotQuery>(
                    mergeQueryOptions(options, { variables: { first: PAGE_SIZE, season_lte: cursor } })
                  ),
                }]);
                const rows = result?.data?.seasons;
                if (!rows) throw new Error('History subgraph returned no data');
                let oldest = cursor + 1;
                rows.forEach((row) => {
                  const seasonNum = getSeasonNumber(row);
                  if (Number.isFinite(seasonNum) && seasonNum >= lower && seasonNum <= cursor) {
                    output[seasonNum] = { ...row, season: seasonNum };
                    oldest = Math.min(oldest, seasonNum);
                  }
                });
                if (rows.length < PAGE_SIZE || oldest <= lower) break;
                if (oldest > cursor) throw new Error('History pagination did not advance');
                cursor = oldest - 1;
              }
            };
            await Promise.all([
              ...(fetchL2 ? [fetchHistory(l2Config, RESEED_SEASON)] : []),
              ...(fetchL1 ? [fetchHistory(l1Config, 1)] : []),
            ]);
          }
        }

        const seasonData = Object.values(output).sort(sortSeasonOutputDesc);

        console.debug('[useSeasonsQuery]: RESULT', name, seasonData);
        return seasonData;
      } catch (e) {
        console.error('e: ', e);
        throw e;
      }
    },
    select: (data) => {
      if (range !== SeasonRange.ALL) {
        const sliced = data.slice(0, SEASON_RANGE_TO_COUNT[range]);
        return sliced;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 seconds
    // staleTime: 1000 * 60 * 20, // 20 minutes
  });

  return useMemo(
    () => ({
      ...query,
      error: query.error ?? undefined,
      data: { seasons: query.data ?? [] },
      loading: enabled && query.isLoading,
    }),
    [query, enabled]
  );
};

export default useSeasonsQuery;

// ---------- Helper Functions ----------

function getNow2ReseedSeasonsDiff() {
  const now = Math.floor(new Date().getTime() / 1000);
  const secondsDiff = now - RESEED_SEASON_TIMESTAMP;

  return Math.floor(secondsDiff / 60 / 60);
}

/**
 * Subgraph queries like SeasonalLiquidityPerPool return season as { season: number }
 * (nested Season entity). Others return season as number. Use this so we always
 * get a numeric season for keys and sorting.
 */
function getSeasonNumber(
  snapshot: MinimumViableSnapshot | null | undefined
): number {
  if (!snapshot) return Number.NaN;
  const s = (snapshot as any).season;
  if (typeof s === 'number' && !Number.isNaN(s)) return s;
  if (s && typeof s === 'object' && typeof (s as any).season === 'number')
    return (s as any).season;
  return Number.NaN;
}

function sortSeasonOutputDesc<T extends MinimumViableSnapshot>(a: T, b: T) {
  const aNum = getSeasonNumber(a);
  const bNum = getSeasonNumber(b);
  if (Number.isNaN(aNum)) return 1;
  if (Number.isNaN(bNum)) return -1;
  return bNum - aNum;
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
