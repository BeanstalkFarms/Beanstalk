import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BaseSeasonPlot from './BaseSeasonPlot';

vi.mock('@mui/material', () => ({
  Box: ({ children }: any) => <div>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Typography: ({ children }: any) => <div>{children}</div>,
  CircularProgress: () => <span>Loading</span>,
}));
vi.mock('../Row', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('./ChartPropProvider', () => ({ ExploitLine: () => null }));
vi.mock('./MultiLineChart', () => ({ default: () => <span>Chart</span> }));
vi.mock('./StackedAreaChart', () => ({ default: () => <span>Chart</span> }));
vi.mock('./TimeTabs', () => ({ default: () => null }));
vi.mock('./SeasonPlot', () => ({ defaultValueFormatter: String }));
vi.mock('./ChartInfoOverlay', () => ({
  default: ({ amount, subtitle, secondSubtitle }: any) => (
    <div>
      {amount}|{subtitle}|{secondSubtitle}
    </div>
  ),
}));

const props = {
  queryData: { data: [[]], loading: false, error: undefined, keys: [] },
  timeTabParams: [[0, 0], () => {}] as any,
  StatProps: { title: 'Liquidity' },
  ChartProps: { getDisplayValue: (data: any[]) => data[0]?.value ?? 0 },
};

describe('chart summary', () => {
  it('does not present empty history as a measured zero in Season 0', () => {
    const html = renderToStaticMarkup(<BaseSeasonPlot {...props} />);
    expect(html).not.toContain('Season 0');
    expect(html).toContain('—');
    expect(html).toContain('No data available');
  });

  it('does not invent a season while loading', () => {
    const html = renderToStaticMarkup(
      <BaseSeasonPlot
        {...props}
        queryData={{ ...props.queryData, loading: true }}
      />
    );
    expect(html).not.toContain('Season 0');
  });

  it('honors an explicit date even when there is no series', () => {
    const html = renderToStaticMarkup(
      <BaseSeasonPlot
        {...props}
        defaultValue={7}
        defaultSeason={123}
        defaultDate={new Date('2020-01-02T12:00:00Z')}
      />
    );
    expect(html).toContain('Season 123');
    expect(html).not.toContain('Invalid Date');
  });
});
