import { readFileSync } from 'fs';
import { buildSchema, graphql, parse, print } from 'graphql';
import { addTypenameToDocument } from '@apollo/client/utilities';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useMarketEventsLazyQuery,
  useHistoricalPodOrdersLazyQuery,
  useHistoricalPodListingsLazyQuery,
} from '~/generated/graphql';
import useMarketActivityData from './useMarketActivityData';
// Exercise the hook's request/state transitions without a browser runtime.
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (value: any) => {
        states[index] =
          typeof value === 'function' ? value(states[index]) : value;
      },
    ];
  },
  useCallback: (callback: any) => {
    fetchHistory = callback;
    return callback;
  },
  useEffect: (effect: () => void) => {
    effects.push(effect);
  },
}));
vi.mock('~/generated/graphql', () => ({
  useMarketEventsLazyQuery: vi.fn(),
  useHistoricalPodOrdersLazyQuery: vi.fn(),
  useHistoricalPodListingsLazyQuery: vi.fn(),
}));
vi.mock('~/hooks/beanstalk/useHarvestableIndex', () => ({ default: () => 0 }));
vi.mock('~/hooks/beanstalk/useSiloTokenToFiat', () => {
  const getUSD = (_token: unknown, amount: unknown) => amount;
  return { default: () => getUSD };
});
vi.mock('~/constants/tokens', () => ({ BEAN: { 1: { decimals: 6 } } }));
vi.mock('~/util', async () => {
  const { default: BigNumber } = await import('bignumber.js');
  return {
    toTokenUnitsBN: (value: any, decimals: number) =>
      new BigNumber(value).div(10 ** decimals),
  };
});
const getEvents = vi.fn(),
  getOrders = vi.fn(),
  getListings = vi.fn();
let result: ReturnType<typeof useMarketActivityData>;
let states: any[] = [],
  cursor = 0,
  effects: (() => void)[] = [],
  fetchHistory: () => Promise<void>;
function renderHook() {
  cursor = 0;
  effects = [];
  result = useMarketActivityData();
}
function event(index: number, type = 'PodOrderCreated') {
  return {
    __typename: type,
    id: `event-${index}`,
    historyID: `history-${index}`,
    createdAt: String(10000 - index),
    hash: `hash-${index}`,
    index: '0',
    start: '0',
    account: '0x0000000000000000000000000000000000000001',
    fromFarmer: '0x0000000000000000000000000000000000000001',
    toFarmer: '0x0000000000000000000000000000000000000002',
    orderId: `order-${index}`,
    maxHarvestableIndex: '1000000',
    amount: '1000000',
    pricePerPod: '500000',
    maxPlaceInLine: '1000000',
    placeInLine: '1000000',
  };
}
// Execute the production query against the checked-in schema so ordering and
// cursor arguments, not call counts, determine which events the server returns.
const schema = buildSchema(
  readFileSync('src/graph/schema-beanstalk.graphql', 'utf8')
);
const marketQuery = readFileSync(
  'src/components/Market/PodsV2/MarketEvents.graphql',
  'utf8'
);
function pages(events: any[]) {
  getEvents.mockImplementation(async ({ variables }: any) => {
    if (getEvents.mock.calls.length > 8)
      throw new Error('unexpected extra page');
    const response = await graphql({
      schema,
      // Apollo adds __typename to every object selection.
      source: print(addTypenameToDocument(parse(marketQuery))),
      variableValues: variables,
      rootValue: {
        marketplaceEvents: ({ first, where, orderBy, orderDirection }: any) =>
          events
            .filter(
              (item) =>
                (where.createdAt_lt === undefined ||
                  Number(item.createdAt) < Number(where.createdAt_lt)) &&
                (where.id_gt === undefined || item.id > where.id_gt)
            )
            .sort((a, b) => {
              const left = orderBy === 'id' ? a.id : Number(a.createdAt);
              const right = orderBy === 'id' ? b.id : Number(b.createdAt);
              const comparison = left < right ? -1 : left > right ? 1 : 0;
              return orderDirection === 'desc' ? -comparison : comparison;
            })
            .slice(0, first),
      },
    });
    return { data: response.data, error: response.errors?.[0] };
  });
}
async function finish() {
  renderHook();
  await expect(fetchHistory()).resolves.toBeUndefined();
  renderHook();
  effects[0]();
  renderHook();
  expect(result.loading).toBe(false);
}
describe('market history loading', () => {
  beforeEach(() => {
    states = [];
    vi.clearAllMocks();
    getEvents.mockReset();
    getOrders.mockReset();
    getListings.mockReset();
    vi.mocked(useMarketEventsLazyQuery).mockReturnValue([getEvents] as any);
    vi.mocked(useHistoricalPodOrdersLazyQuery).mockReturnValue([
      getOrders,
    ] as any);
    vi.mocked(useHistoricalPodListingsLazyQuery).mockReturnValue([
      getListings,
    ] as any);
  });
  it('finishes after an empty page following exactly 1000 events', async () => {
    pages(Array.from({ length: 1000 }, (_, i) => event(i)));
    await finish();
    expect(result.error).toBe(false);
    expect(result.data).toHaveLength(1000);
    expect(getEvents).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['PodOrderFilled', 999],
    ['PodOrderFilled', 1000],
    ['PodOrderFilled', 1001],
    ['PodOrderFilled', 2000],
    ['PodListingFilled', 999],
    ['PodListingFilled', 1000],
    ['PodListingFilled', 1001],
    ['PodListingFilled', 2000],
  ])('joins all details for %s with %i events', async (type, count) => {
    pages(
      Array.from({ length: count as number }, (_, i) =>
        event(i, type as string)
      )
    );
    const details = async ({ variables }: any) => ({
      data: {
        [type === 'PodOrderFilled' ? 'podOrders' : 'podListings']:
          variables.historyIDs.map((historyID: string) => ({
            historyID,
            id: historyID,
            pricePerPod: '500000',
            filledAmount: '1000000',
          })),
      },
    });
    getOrders.mockImplementation(details);
    getListings.mockImplementation(details);
    await finish();
    expect(result.error).toBe(false);
    expect(result.data).toHaveLength(count as number);
    expect(result.data[(count as number) - 1].amountBeans.toString()).toBe(
      '0.5'
    );
  });
  it.each([1001, 2501])(
    'retains all %i events sharing one timestamp across page boundaries',
    async (count) => {
      pages(
        Array.from({ length: count }, (_, i) => ({
          ...event(i),
          createdAt: '5000',
        }))
      );
      await finish();
      expect(result.error).toBe(false);
      expect(result.data).toHaveLength(count);
      expect(result.data.slice(0, 3).map((item) => item.eventId)).toEqual([
        'event-0',
        'event-1',
        'event-10',
      ]);
      expect(new Set(result.data.map((item) => item.eventId)).size).toBe(count);
    }
  );
  it('returns complete history newest first when IDs and timestamps disagree', async () => {
    pages([
      ...Array.from({ length: 1100 }, (_, i) => ({
        ...event(i),
        createdAt: '5000',
      })),
      { ...event(1100), id: 'z-newest', createdAt: '7000' },
      { ...event(1101), id: 'a-oldest', createdAt: '1000' },
    ]);
    await finish();
    expect(result.error).toBe(false);
    expect(result.data).toHaveLength(1102);
    expect(result.data[0].eventId).toBe('z-newest');
    expect(result.data[1101].eventId).toBe('a-oldest');
    expect(new Set(result.data.map((item) => item.eventId)).size).toBe(1102);
  });
  it('ignores cancellation events without a history ID', async () => {
    getEvents.mockResolvedValue({
      data: {
        marketEvents: [{ ...event(0, 'PodOrderCancelled'), historyID: null }],
      },
    });
    await finish();
    expect(result.error).toBe(false);
    expect(result.data).toEqual([]);
  });
  it('accepts empty history as a successful result', async () => {
    pages([]);
    await finish();
    expect(result.error).toBe(false);
    expect(result.data).toEqual([]);
  });
  it('discards partial events when a later page fails', async () => {
    getEvents
      .mockResolvedValueOnce({
        data: {
          marketEvents: Array.from({ length: 1000 }, (_, i) => event(i)),
        },
      })
      .mockRejectedValue(new Error('page unavailable'));
    await finish();
    expect(result.error).toBe(true);
    expect(result.data).toEqual([]);
  });
  it('discards tied events if a later ID page returns an Apollo error', async () => {
    pages(
      Array.from({ length: 2501 }, (_, i) => ({
        ...event(i),
        createdAt: '5000',
      }))
    );
    const successfulPage = getEvents.getMockImplementation()!;
    getEvents.mockImplementation(async (...args: any[]) => {
      const response = await successfulPage(...args);
      return getEvents.mock.calls.length === 2
        ? { ...response, error: new Error('page unavailable') }
        : response;
    });
    await finish();
    expect(result.error).toBe(true);
    expect(result.data).toEqual([]);
  });
  it.each(['PodOrderFilled', 'PodListingFilled'])(
    'settles loading and exposes rejected %s details',
    async (type) => {
      pages([event(0, type)]);
      getOrders.mockRejectedValue(new Error('details unavailable'));
      getListings.mockRejectedValue(new Error('details unavailable'));
      await finish();
      expect(result.error).toBe(true);
      expect(result.data).toEqual([]);
    }
  );
  it('exposes a resolved Apollo error instead of accepting its partial events', async () => {
    getEvents.mockResolvedValue({
      data: { marketEvents: [event(0)] },
      error: new Error('GraphQL error'),
    });
    await finish();
    expect(result.error).toBe(true);
    expect(result.data).toEqual([]);
  });
});
