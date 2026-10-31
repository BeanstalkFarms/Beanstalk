import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LiquidityOverTime from './LiquidityOverTime';
import useSeasonsQuery from '~/hooks/beanstalk/useSeasonsQuery';

vi.mock('~/util/wagmi/Client', () => ({ default: { provider: undefined } }));
vi.mock('~/hooks/beanstalk/useSeason', () => ({ default: () => 43128 }));
vi.mock('~/hooks/app/useTimeTabState', () => ({
  default: () => [[0, 0], () => {}],
}));
vi.mock('~/hooks/beanstalk/useSeasonsQuery', () => ({
  default: vi.fn(),
  SeasonRange: { WEEK: 0, MONTH: 1, ALL: 2 },
  SEASON_RANGE_TO_COUNT: { 0: 168, 1: 672 },
}));
vi.mock('../Common/Charts/BaseSeasonPlot', () => ({
  default: ({ queryData }: any) => (
    <div>
      {queryData.loading
        ? 'Loading'
        : queryData.error
          ? 'Unavailable'
          : 'Ready'}
    </div>
  ),
}));

describe('liquidity query failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not block weekly liquidity on unused historical pools', () => {
    vi.mocked(useSeasonsQuery).mockImplementation(
      (name) =>
        ({
          loading: name.endsWith('Old'),
          data: { seasons: [] },
          error: undefined,
        }) as any
    );
    expect(renderToStaticMarkup(<LiquidityOverTime />)).toContain('Ready');
    const oldCalls = vi
      .mocked(useSeasonsQuery)
      .mock.calls.filter(([name]) => name.endsWith('Old'));
    expect(oldCalls).toHaveLength(3);
    expect(oldCalls.every((args) => args[5] === false)).toBe(true);
  });

  it('does not present a successful total when an active pool failed', () => {
    vi.mocked(useSeasonsQuery).mockImplementation(
      (name) =>
        ({
          loading: false,
          data: { seasons: [] },
          error:
            name === 'seasonalLiquidityBeanETH'
              ? new Error('unavailable')
              : undefined,
        }) as any
    );
    expect(renderToStaticMarkup(<LiquidityOverTime />)).toContain(
      'Unavailable'
    );
  });
});
