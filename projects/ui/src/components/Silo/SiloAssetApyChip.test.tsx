import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BigNumber from 'bignumber.js';
import { describe, expect, it, vi } from 'vitest';
import useAPY from '~/hooks/beanstalk/useAPY';
import SiloAssetApyChip from './SiloAssetApyChip';

vi.mock('~/hooks/beanstalk/useAPY', () => ({ default: vi.fn() }));
vi.mock('~/hooks/beanstalk/useTokens', () => ({
  useTokens: () => ({ BEAN: { symbol: 'BEAN', displayDecimals: 2 } }),
}));
vi.mock('~/util', () => ({
  displayFullBN: (value: BigNumber) => value.toFixed(2),
}));
// Expose the tooltip content during server rendering, without browser hover/portals.
vi.mock('@mui/material', async () => ({
  ...(await vi.importActual<any>('@mui/material')),
  Tooltip: ({ children, title }: any) => (
    <>
      {children}
      <aside>{title}</aside>
    </>
  ),
}));
function render(
  data?: ReturnType<typeof useAPY>['data'],
  error?: Error,
  loading = false,
  metric: 'bean' | 'stalk' = 'bean'
) {
  vi.mocked(useAPY).mockReturnValue({ data, error, loading } as any);
  return renderToStaticMarkup(
    <SiloAssetApyChip
      token={{ address: 'bean', name: 'Bean' } as any}
      metric={metric}
    />
  );
}
const zero = new BigNumber(0);
const dayData = {
  beansPerSeasonEMA24h: zero,
  byToken: { bean: { '24h': { bean: zero, stalk: zero } } },
};

describe('Silo APY display', () => {
  it('does not show missing yields or tooltip totals as zero', () => {
    const html = render();
    expect(html).not.toContain('0.0%');
    expect(html).toContain('—');
    expect(html).toContain('No APY data available');
    expect(html).not.toMatch(/>0(?:\.0+)?<\//);
  });
  it('shows an error distinctly from empty results', () => {
    const html = render(undefined, new Error('failed'));
    expect(html).toContain('Unavailable');
    expect(html).not.toContain('0.0%');
  });
  it('preserves genuine zero while leaving missing periods unavailable', () => {
    const html = render(dayData);
    expect(html.match(/0\.0%/g)).toHaveLength(1);
    expect(html).toContain('—');
    expect(html).toContain('0.00');
  });
  it('shows a loading indicator without zero yields', () => {
    const html = render(undefined, undefined, true);
    expect(html).toContain('progressbar');
    expect(html).not.toContain('0.0%');
    expect(html).toContain('Loading');
  });
  it('does not present cached yields as current after a query error', () => {
    const html = render(dayData, new Error('failed'));
    expect(html).toContain('Unavailable');
    expect(html).not.toContain('0.0%');
  });
  it('renders a missing Stalk monthly yield as unavailable', () => {
    expect(render(dayData, undefined, false, 'stalk')).not.toContain('0.0%');
  });
});
