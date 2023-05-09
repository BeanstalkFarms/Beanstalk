import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { client } from "src/utils/wagmi/Client";
import { ConnectKitProvider } from "connectkit";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { WagmiConfig } from "wagmi";
import { SdkProvider } from "../../utils/sdk/SdkProvider";
import { Avatar } from "src/utils/wagmi/Avatar";
import { TokenProvider } from "src/tokens/TokenProvider";
import { OnLoad } from "./OnLoad";

export const Wrapper: FC<{}> = ({ children }) => {
  const queryClient = new QueryClient();
  return (
    <HashRouter>
      <WagmiConfig client={client}>
        <ConnectKitProvider
          theme="minimal"
          mode="dark"
          options={{
            customAvatar: Avatar,
            initialChainId: 0,
            hideBalance: true
          }}
        >
          <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools initialIsOpen={false} />
            <SdkProvider>
              <TokenProvider>
                <OnLoad>{children}</OnLoad>
              </TokenProvider>
            </SdkProvider>
          </QueryClientProvider>
        </ConnectKitProvider>
      </WagmiConfig>
    </HashRouter>
  );
};
