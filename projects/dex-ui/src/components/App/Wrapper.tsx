import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConnectKitProvider } from "connectkit";
import { HashRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";

import JotaiProvider from "src/state";
import { FC } from "src/types";
import { Avatar } from "src/utils/wagmi/Avatar";
import { config } from "src/utils/wagmi/config";

import { OnLoad } from "./OnLoad";

export const Wrapper: FC<{}> = ({ children }) => {
  const queryClient = new QueryClient();
  return (
    <HashRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider
            theme="minimal"
            mode="dark"
            options={{
              customAvatar: Avatar,
              initialChainId: 0,
              hideBalance: true
            }}
            customTheme={{
              "--ck-font-family": "PPMori",
              "--ck-modal-box-shadow": "0px 0px 0px 2px black"
            }}
          >
            <ReactQueryDevtools initialIsOpen={false} />
            <JotaiProvider>
              <OnLoad>{children}</OnLoad>
            </JotaiProvider>
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HashRouter>
  );
};
