// @vitest-environment jsdom

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import theme from '~/components/App/muiTheme';
import useNavHeight from './usePageDimensions';

vi.mock('~/hooks/chain/useChainState', () => ({
  default: () => ({ isArbitrum: true }),
}));

const NavHeightProbe = () => <output>{useNavHeight(false)}</output>;

describe('useNavHeight', () => {
  it('includes the desktop RFF banner in the Arbitrum navigation height', () => {
    render(
      <ThemeProvider theme={theme}>
        <NavHeightProbe />
      </ThemeProvider>
    );

    expect(screen.getByText('121')).toBeTruthy();
  });
});
