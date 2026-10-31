import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApolloLink, Observable, gql } from '@apollo/client';
import { useQuery } from '@tanstack/react-query';

vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(() => ({})) }));
vi.mock('~/constants', () => ({ RESEED_SEASON: 1001 }));
vi.mock('~/state', () => ({
  default: { getState: () => ({ app: { settings: {} } }) },
}));
vi.mock('~/util', () => ({ exists: (value: unknown) => value != null }));
vi.mock('~/util/Graph', () => ({
  // Nested pool filters never enter this branch of the production cache policy.
  binarySearchSeasons: () => {
    throw new Error('Unexpected flat season filter');
  },
}));
vi.mock('apollo3-cache-persist', () => ({
  LocalStorageWrapper: class {},
  persistCacheSync: () => {},
}));
vi.mock('~/util/Bottleneck', () => ({
  fetchApolloWithLimiter: (requests: any[]) =>
    Promise.all(requests.map((r) => r.request())),
}));

const document = gql`
  query PoolHistory($first: Int, $season_lte: Int, $pool: String!) {
    seasons: poolHourlySnapshots(
      first: $first
      where: {
        pool: $pool
        season_: { season_lte: $season_lte, season_gte: 0 }
      }
      orderBy: season__season
      orderDirection: desc
    ) {
      id
      season {
        season
      }
      timestamp
    }
  }
`;

const previousWindow = globalThis.window;
const previousSnapshotKey = import.meta.env.VITE_SNAPSHOT_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.window = previousWindow;
  import.meta.env.VITE_SNAPSHOT_API_KEY = previousSnapshotKey;
  vi.clearAllMocks();
});

describe('history with the production Apollo cache', () => {
  it.each(['l2-only', 'both'] as const)(
    'returns complete %s history with nested season filters',
    async (fetchType) => {
      import.meta.env.VITE_SNAPSHOT_API_KEY = 'test';
      vi.stubGlobal('window', { localStorage: {} });
      vi.spyOn(console, 'debug').mockImplementation(() => {});
      const { apolloClient } = await import('~/graph/client');
      const { default: useSeasonsQuery, SeasonRange } = await import(
        './useSeasonsQuery'
      );
      await apolloClient.clearStore();
      // Only replace transport: the real InMemoryCache and its read/merge policies run.
      apolloClient.setLink(
        new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              const l1 = operation.getContext().subgraph === 'beanstalk_eth';
              const upper = Math.min(
                operation.variables.season_lte,
                l1 ? 1000 : 2002
              );
              const lower = l1 ? 999 : 1001;
              const count = Math.max(
                0,
                Math.min(operation.variables.first, upper - lower + 1)
              );
              observer.next({
                data: {
                  seasons: Array.from({ length: count }, (_, i) => ({
                    __typename: 'PoolHourlySnapshot',
                    id: String(upper - i),
                    season: { __typename: 'Season', season: upper - i },
                    timestamp: '1',
                  })),
                },
              });
              observer.complete();
            })
        )
      );
      useSeasonsQuery(
        'pool',
        { document, queryConfig: { variables: { pool: 'pool' } } },
        null,
        SeasonRange.ALL,
        fetchType
      );
      const run = (vi.mocked(useQuery).mock.calls[0][0] as any).queryFn;
      const result = await run();
      expect(result).toHaveLength(fetchType === 'both' ? 1004 : 1002);
      expect(result[0].season).toBe(2002);
      expect(result.at(-1).season).toBe(fetchType === 'both' ? 999 : 1001);
    }
  );
});
