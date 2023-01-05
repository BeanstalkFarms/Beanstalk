import React from 'react';
import { HashRouter } from 'react-router-dom';
import { Provider as ReduxProvider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import { WagmiConfig } from 'wagmi';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import theme from '~/components/App/muiTheme';
import client from '~/util/Client';
import { apolloClient } from '~/graph/client';
import store from '~/state';

import { FC } from '~/types';

const Wrapper : FC<{}> = ({ children }) => (
  <HashRouter>
    <ReduxProvider store={store}>
      <ApolloProvider client={apolloClient}>
        <WagmiConfig client={client}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </WagmiConfig>
      </ApolloProvider>
    </ReduxProvider>
  </HashRouter>
);

export default Wrapper;
