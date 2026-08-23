// @vitest-environment jsdom

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import theme from '~/components/App/muiTheme';
import RffLiquidityNotice from './RffLiquidityNotice';

describe('RffLiquidityNotice', () => {
  it('links the liquidity announcement and opens the request flow', () => {
    const onRequest = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <RffLiquidityNotice
          announcementUrl="https://discord.com/channels/1/2/3"
          onRequest={onRequest}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Liquidity removal notice')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /announcement/i }).getAttribute('href')
    ).toBe('https://discord.com/channels/1/2/3');

    fireEvent.click(screen.getByRole('button', { name: 'Request a Fill' }));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});
