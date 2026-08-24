// @vitest-environment jsdom

import React, { act } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import theme from '~/components/App/muiTheme';
import useNavHeight from '~/hooks/app/usePageDimensions';
import NavBar from './NavBar';

vi.mock('~/hooks/chain/useChainState', () => ({
  default: () => ({ isArbitrum: true, isArbMainnet: true }),
}));
vi.mock('~/components/Common/Connection/WalletButton', () => ({
  default: () => <button type="button">Wallet</button>,
}));
vi.mock('~/components/Common/Connection/NetworkButton', () => ({
  default: () => <button type="button">Network</button>,
}));
vi.mock('./Buttons/PriceButton', () => ({
  default: () => <button type="button">Price</button>,
}));
vi.mock('./Buttons/SunButton', () => ({
  default: () => <button type="button">Season</button>,
}));
vi.mock('./Buttons/AboutButton', () => ({
  default: () => <button type="button">About</button>,
}));
vi.mock('./Buttons/LinkButton', () => ({ default: () => null }));
vi.mock('./HoverMenu', () => ({ default: () => null }));
vi.mock('./routes', () => ({ default: { top: [], more: [] } }));
vi.mock('~/lib/Rff/runtime', () => ({
  RFF_ANNOUNCEMENT_URL: 'https://example.com/ebip',
}));

describe('NavBar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places the RFF issue announcement above the navigation controls', () => {
    const LocationProbe = () => <output>{useLocation().pathname}</output>;

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider theme={theme}>
          <NavBar>{null}</NavBar>
          <LocationProbe />
        </ThemeProvider>
      </MemoryRouter>
    );

    const banner = screen.getByRole('alert', {
      name: 'RFF liquidity migration notice',
    });
    const price = screen.getByRole('button', { name: 'Price' });

    expect(banner.compareDocumentPosition(price)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      screen
        .getByRole('link', { name: 'Read more about it here' })
        .getAttribute('href')
    ).toBe('https://example.com/ebip');
    expect(banner.querySelector('.MuiAlert-icon')).toBeNull();

    fireEvent.click(banner);
    expect(screen.getByText('/swap')).toBeTruthy();
  });

  it('dismisses the issue banner for 24 hours without opening Swap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));

    const LocationProbe = () => <output>{useLocation().pathname}</output>;
    const NavHeightProbe = () => <output>{useNavHeight(false)}</output>;
    const TestApp = () => (
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider theme={theme}>
          <NavBar>{null}</NavBar>
          <LocationProbe />
          <NavHeightProbe />
        </ThemeProvider>
      </MemoryRouter>
    );
    const view = render(<TestApp />);

    expect(screen.getByText('121')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss liquidity notice' })
    );

    expect(
      screen.queryByRole('alert', {
        name: 'RFF liquidity migration notice',
      })
    ).toBeNull();
    expect(screen.getByText('/')).toBeTruthy();
    expect(screen.getByText('65')).toBeTruthy();

    view.unmount();
    const reopenedView = render(<TestApp />);
    expect(
      screen.queryByRole('alert', {
        name: 'RFF liquidity migration notice',
      })
    ).toBeNull();
    expect(screen.getByText('65')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1);
    });
    expect(
      screen.queryByRole('alert', {
        name: 'RFF liquidity migration notice',
      })
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByRole('alert', {
        name: 'RFF liquidity migration notice',
      })
    ).toBeTruthy();
    expect(screen.getByText('121')).toBeTruthy();

    reopenedView.unmount();
  });
});
