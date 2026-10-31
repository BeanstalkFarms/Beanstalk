import { beforeEach, describe, expect, it, vi } from 'vitest';
import useSeasonsQuery, { SeasonRange } from './useSeasonsQuery';
import { apolloClient } from '~/graph/client';
import { useQuery } from '@tanstack/react-query';

vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(() => ({})) }));
vi.mock('~/constants', () => ({ RESEED_SEASON: 1001 }));
vi.mock('~/graph/client', () => ({
  apolloClient: { query: vi.fn(), readQuery: vi.fn(() => null) },
}));
// Keep the request and failure semantics, without the limiter's retry delays.
vi.mock('~/util/Bottleneck', () => ({
  fetchApolloWithLimiter: async (requests: any[], options?: any) => {
    const results = await Promise.allSettled(requests.map((r) => r.request()));
    const failure = results.find((r) => r.status === 'rejected');
    if (failure && options?.throws !== false) throw (failure as any).reason;
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  },
}));

const document = { kind: 'Document', definitions: [] } as any;
const snapshot = (season: number) => ({
  id: String(season),
  season: { season },
  timestamp: '1',
});

function queryFn(cached = true, fetchType: 'both' | 'l2-only' = 'l2-only') {
  useSeasonsQuery(
    'history',
    { document },
    cached ? { document } : null,
    SeasonRange.ALL,
    fetchType
  );
  return (vi.mocked(useQuery).mock.calls[0][0] as any).queryFn;
}

describe('season history recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables unused historical queries without reporting them as loading', () => {
    const result = useSeasonsQuery(
      'unused',
      { document },
      null,
      SeasonRange.ALL,
      'l1-only',
      false
    );
    expect((vi.mocked(useQuery).mock.calls[0][0] as any).enabled).toBe(false);
    expect(result.loading).toBe(false);
  });

  it('recovers all-time history from the live subgraph when the cache fails', async () => {
    vi.mocked(apolloClient.query).mockImplementation(async (options: any) => {
      if (options.context.subgraph === 'cache')
        throw new Error('Internal Server Error');
      return {
        data: { seasons: [snapshot(1003), snapshot(1002), snapshot(1001)] },
      } as any;
    });
    expect((await queryFn()()).map((s: any) => s.season)).toEqual([
      1003, 1002, 1001,
    ]);
  });

  it('paginates L2 with the L2 cursor even when no L1 history is requested', async () => {
    vi.mocked(apolloClient.query).mockImplementation(async (options: any) => {
      if (options.context.subgraph !== 'beanstalk')
        return { data: { seasons: [] } } as any;
      const upper = options.variables.season_lte;
      const seasons =
        upper === 999999999
          ? Array.from({ length: 1000 }, (_, i) => snapshot(2002 - i))
          : upper === 1002
            ? [snapshot(1002), snapshot(1001)]
            : [];
      return { data: { seasons } } as any;
    });
    const result = await queryFn(false)();
    expect(result).toHaveLength(1002);
    expect(result.at(-1).season).toBe(1001);
  });

  it('exposes a failure when neither cache nor live history is available', async () => {
    vi.mocked(apolloClient.query).mockRejectedValue(new Error('unavailable'));
    await expect(queryFn()()).rejects.toThrow('unavailable');
  });

  it('uses a healthy cache without querying live history', async () => {
    vi.mocked(apolloClient.query).mockImplementation(async (options: any) => {
      if (options.context.subgraph !== 'cache')
        throw new Error('unexpected live request');
      return { data: { seasons: [snapshot(1002), snapshot(1001)] } } as any;
    });
    expect((await queryFn()()).map((s: any) => s.season)).toEqual([1002, 1001]);
  });

  it('combines Ethereum and Arbitrum history at the migration boundary', async () => {
    vi.mocked(apolloClient.query).mockImplementation(
      async (options: any) =>
        ({
          data: {
            seasons:
              options.context.subgraph === 'beanstalk'
                ? [snapshot(1002), snapshot(1001)]
                : [snapshot(1000), snapshot(999)],
          },
        }) as any
    );
    expect((await queryFn(false, 'both')()).map((s: any) => s.season)).toEqual([
      1002, 1001, 1000, 999,
    ]);
  });

  it('rejects a failed later page instead of returning incomplete history', async () => {
    vi.mocked(apolloClient.query).mockImplementation(async (options: any) => {
      if (options.variables.season_lte !== 999999999)
        throw new Error('page unavailable');
      return {
        data: {
          seasons: Array.from({ length: 1000 }, (_, i) => snapshot(2002 - i)),
        },
      } as any;
    });
    await expect(queryFn(false)()).rejects.toThrow('page unavailable');
  });

  it('stops with an error if a full page repeats without advancing', async () => {
    vi.mocked(apolloClient.query).mockResolvedValue({
      data: {
        seasons: Array.from({ length: 1000 }, (_, i) => snapshot(2002 - i)),
      },
    } as any);
    await expect(queryFn(false)()).rejects.toThrow('did not advance');
  });
});
