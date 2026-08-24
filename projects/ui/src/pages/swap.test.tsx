// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import SwapPage from './swap';

vi.mock('~/components/Common/PageHeader', () => ({
  default: () => <header>Swap heading</header>,
}));
vi.mock('~/components/Common/Guide/GuideButton', () => ({
  default: () => null,
}));
vi.mock('~/components/Swap/Actions', () => ({
  default: () => <section aria-label="Swap form" />,
}));
vi.mock('~/components/Swap/Rff', () => ({
  default: () => <aside aria-label="Liquidity removal notice" />,
}));
describe('SwapPage', () => {
  it('does not duplicate the global RFF announcement inside the page', () => {
    render(<SwapPage />);

    expect(
      screen.queryByRole('alert', {
        name: 'RFF liquidity migration notice',
      })
    ).toBeNull();
  });

  it('places the liquidity removal notice after the primary swap form', () => {
    render(<SwapPage />);

    const swap = screen.getByRole('region', { name: 'Swap form' });
    const notice = screen.getByRole('complementary', {
      name: 'Liquidity removal notice',
    });

    expect(swap.nextElementSibling).toBe(notice);
  });
});
