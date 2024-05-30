import React from 'react';
import { HashRouter } from 'react-router-dom';
import { Provider as ReduxProvider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
// import { WagmiConfig } from 'wagmi';
import { WagmiProvider } from 'wagmi';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { config } from '~/util/wagmi/config';
import theme from '~/components/App/muiTheme';
// import client from '~/util/wagmi/Client';
import { apolloClient } from '~/graph/client';
import store from '~/state';
import { FC } from '~/types';
import SdkProvider from './SdkProvider';

const queryClient = new QueryClient();

const Wrapper: FC<{}> = ({ children }) => (
  <HashRouter>
    <ReduxProvider store={store}>
      <ApolloProvider client={apolloClient}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <SdkProvider>{children}</SdkProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </ApolloProvider>
    </ReduxProvider>
  </HashRouter>
);

export default Wrapper;
