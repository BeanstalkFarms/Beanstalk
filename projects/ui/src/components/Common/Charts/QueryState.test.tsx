import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import QueryState from './QueryState';

describe('chart query state', () => {
  it('shows the empty state when every series is empty', () => {
    const html = renderToStaticMarkup(
      <QueryState
        queryData={{ data: [[]], loading: false, error: undefined, keys: [] }}
        loading={<span>Loading</span>}
        error={<span>Unavailable</span>}
        empty={<span>No data</span>}
        success={<span>Chart</span>}
      />
    );
    expect(html).toContain('No data');
  });

  it('allows a valid zero-valued series', () => {
    const html = renderToStaticMarkup(
      <QueryState
        queryData={{
          data: [[{ season: 10, value: 0, date: new Date(0) } as any]],
          loading: false,
          error: undefined,
          keys: [],
        }}
        loading={<span>Loading</span>}
        error={<span>Unavailable</span>}
        empty={<span>No data</span>}
        success={<span>Chart</span>}
      />
    );
    expect(html).toContain('Chart');
  });
});
