// @vitest-environment jsdom

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';

import theme from '~/components/App/muiTheme';
import RffRequestInfo, {
  RffMinimumReceivedLabel,
} from './RffRequestInfo';

describe('RffRequestInfo', () => {
  it('describes the RFF intent and links to the EBIP', () => {
    render(
      <ThemeProvider theme={theme}>
        <RffRequestInfo
          announcementUrl="https://example.com/ebip"
          safeAddress="0x1111111111111111111111111111111111111111"
        />
      </ThemeProvider>
    );

    expect(
      screen.getByText(/submit an intent to swap bean/i)
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'See EBIP →' }).getAttribute('href')
    ).toBe('https://example.com/ebip');
    expect(
      screen.getByRole('link', { name: 'RFF Multisig' }).getAttribute('href')
    ).toBe(
      'https://app.safe.global/home?safe=arb1:0x1111111111111111111111111111111111111111'
    );
  });

  it('explains the executable amount beside Minimum received', async () => {
    render(
      <ThemeProvider theme={theme}>
        <RffMinimumReceivedLabel />
      </ThemeProvider>
    );

    fireEvent.mouseOver(
      screen.getByRole('button', { name: 'How the fill amount is determined' })
    );

    expect(
      await screen.findByText(
        /minimum of: 1\) the requested RFF amount, 2\) the approved amount, and 3\) the user’s total selected balance at the time of fill/i
      )
    ).toBeTruthy();
  });
});
