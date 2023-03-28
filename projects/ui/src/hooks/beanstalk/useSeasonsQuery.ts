import { useEffect, useState } from 'react';
import { DocumentNode, QueryOptions, useLazyQuery } from '@apollo/client';
import { apolloClient } from '~/graph/client';

const PAGE_SIZE = 1000;

export enum SeasonAggregation {
  HOUR = 0,
  DAY,
}

export enum SeasonRange {
  WEEK = 0,
  MONTH = 1,
  ALL = 2,
}

export const SEASON_RANGE_TO_COUNT : { [key in SeasonRange]: number | undefined } = {
  [SeasonRange.WEEK]:  168, // 7*24
  [SeasonRange.MONTH]: 672, // 28*24
  [SeasonRange.ALL]:   undefined,
} as const;

/**
 * The minimum data points that each Snapshot should acquire.
 */
export type MinimumViableSnapshot = {
  id: string;
  season: number;
  timestamp: string;
}

/**
 * Query data containing an array of Snapshots.
 */
export type MinimumViableSnapshotQuery = { 
  seasons: (MinimumViableSnapshot & any)[]
};

/**
 * Extracts a single data point from an array of Snapshots.
 */
export type SnapshotData<T extends MinimumViableSnapshotQuery> = T['seasons'][number]; 

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
  document: DocumentNode,
  range:    SeasonRange,
  queryConfig?:  Partial<QueryOptions>,
) => {
  /// Custom loading prop
  const [loading, setLoading] = useState(false);
  
  /// Execute generic lazy query
  const [get, query] = useLazyQuery<T>(document, { variables: {} });

  useEffect(() => {
    (async () => {
      console.debug(`[useSeasonsQuery] initializing with range = ${range}`);
      try {
        if (range !== SeasonRange.ALL) {
          // data.seasons is sorted by season, descending.
          const variables = {
            ...queryConfig?.variables,
            first: SEASON_RANGE_TO_COUNT[range],
            season_lte: 999999999
          };
          console.debug('[useSeasonsQuery] run', { variables });
          await get({
            ...queryConfig,
            variables,
            fetchPolicy: 'cache-first',
          });
        } else {
          // Initialize Season data with a call to the first set of Seasons.
          const variables = {
            ...queryConfig?.variables,
            first: undefined,
            season_lte: 999999999
          };
          console.debug('[useSeasonsQuery] run', { variables });

          const init = await get({
            ...queryConfig,
            variables,
          });
          console.debug('[useSeasonsQuery] init: data = ', init.data);

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

          console.debug(`[useSeasonsQuery] requested all seasons. current season is ${latestSubgraphSeason}. oldest loaded season ${init.data.seasons[init.data.seasons.length - 1]}`, init.data.seasons, queryConfig);

          /**
           * 3000 / 1000 = 3 queries
           * Season    1 - 1000
           *        1001 - 2000
           *        2001 - 3000
           */
          const numQueries = Math.ceil(
            /// If `season_gt` is provided, we only query back to that season.
            (latestSubgraphSeason - (queryConfig?.variables?.season_gt || 0))
            / PAGE_SIZE
          );
          const promises = [];
          console.debug(`[useSeasonsQuery] needs ${numQueries} calls to get ${latestSubgraphSeason} more seasons`);
          setLoading(true);
          for (let i = 0; i < numQueries; i += 1) {
            const season = Math.max(
              0, // always at least 0
              latestSubgraphSeason - i * PAGE_SIZE,
            );
            const thisVariables = {
              ...queryConfig?.variables,
              first: season < 1000 ? (season - 1) : 1000,
              season_lte: season,
            };
            promises.push(
              apolloClient.query({
                ...queryConfig,
                query: document,
                variables: thisVariables,
                notifyOnNetworkStatusChange: true,
              }).then((r) => {
                console.debug(`[useSeasonsQuery] get: ${season} -> ${Math.max(season - 1000, 1)} =`, r.data, { variables: thisVariables, document });
                return r;
              })
            );
          }

          /**
           * Wait for queries to complete
           */
          await Promise.all(promises);
          setLoading(false);
        }
      } catch (e) {
        console.debug('[useSeasonsQuery] failed');
        console.error(e);
      }
    })();
  }, [range, get, queryConfig, document]);

  return {
    ...query,
    loading: loading || query.loading,
  }; 
};

export default useSeasonsQuery;
