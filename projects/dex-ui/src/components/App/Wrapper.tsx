import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { client } from "src/utils/wagmi/Client";
import { ConnectKitProvider } from "connectkit";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiConfig } from "wagmi";
import { SdkProvider } from "../../utils/sdk/SdkProvider";
import { Avatar } from "src/utils/wagmi/Avatar";
import { TokenProvider } from "src/utils/TokenProvider";

export const Wrapper: FC<{}> = ({ children }) => {
  const queryClient = new QueryClient();
  return (
    <HashRouter>
      <WagmiConfig client={client}>
        <ConnectKitProvider
          theme="auto"
          mode="dark"
          options={{
            customAvatar: Avatar,
            initialChainId: 0,
            hideBalance: true
          }}
        >
          <SdkProvider>
            <QueryClientProvider client={queryClient}>
              <TokenProvider>{children}</TokenProvider>
            </QueryClientProvider>
          </SdkProvider>
        </ConnectKitProvider>
      </WagmiConfig>
    </HashRouter>
  );
};
