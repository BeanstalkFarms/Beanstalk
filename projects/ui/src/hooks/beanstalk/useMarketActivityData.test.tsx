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
    amount: '1000000',
    pricePerPod: '500000',
    maxPlaceInLine: '1000000',
    placeInLine: '1000000',
  };
}
function pages(events: any[]) {
  getEvents.mockImplementation(async () => {
    // Bound a broken paginator so the suite reports the defect instead of hanging.
    if (getEvents.mock.calls.length > 4)
      throw new Error('unexpected extra page');
    return {
      data: {
        marketEvents: events.slice(
          (getEvents.mock.calls.length - 1) * 1000,
          getEvents.mock.calls.length * 1000
        ),
      },
    };
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
  it('ignores cancellation events without a history ID', async () => {
    pages([{ ...event(0, 'PodOrderCancelled'), historyID: null }]);
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
