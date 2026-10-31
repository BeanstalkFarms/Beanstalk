import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useLatestApyQuery } from '~/generated/graphql';
import useAPY from './useAPY';

vi.mock('~/generated/graphql', () => ({ useLatestApyQuery: vi.fn() }));
const snapshot = (value = '0') => ({
  id: '1',
  season: 1,
  beansPerSeasonEMA: value,
  tokenAPYS: [{ token: 'bean', beanAPY: value, stalkAPY: value }],
});
function read(data: unknown, error?: Error, loading = false) {
  vi.mocked(useLatestApyQuery).mockReturnValue({ data, error, loading } as any);
  let result: ReturnType<typeof useAPY>;
  function Probe() {
    result = useAPY();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result!;
}

describe('Silo APY partial responses', () => {
  it('keeps day data when week and month are empty', () => {
    const result = read({ day: [snapshot()], week: [], month: [] });
    expect(result.data?.byToken.bean['24h']?.bean.toString()).toBe('0');
    expect(result.data?.byToken.bean['7d']).toBeUndefined();
    expect(result.data?.beansPerSeasonEMA30d).toBeUndefined();
  });
  it('keeps month data when day is empty', () => {
    const result = read({ day: [], week: [], month: [snapshot('0.02')] });
    expect(result.data?.byToken.bean['30d']?.bean.toString()).toBe('0.02');
    expect(result.data?.beansPerSeasonEMA24h).toBeUndefined();
  });
  it('retains errors even with cached data', () => {
    const error = new Error('unavailable');
    expect(
      read(
        { day: [snapshot()], week: [snapshot()], month: [snapshot()] },
        error
      ).error
    ).toBe(error);
  });
  it('represents empty and initial loading results without fabricated yields', () => {
    expect(read({ day: [], week: [], month: [] }).data).toBeUndefined();
    const result = read(undefined, undefined, true);
    expect(result.data).toBeUndefined();
    expect(result.loading).toBe(true);
  });
});
