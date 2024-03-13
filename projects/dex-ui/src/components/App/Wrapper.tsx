import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Avatar } from "src/utils/wagmi/Avatar";
import { TokenProvider } from "src/tokens/TokenProvider";
import { OnLoad } from "./OnLoad";
import { SdkProvider } from "src/utils/sdk/SdkProvider";
import { config } from "src/utils/wagmi/config";

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
            <SdkProvider>
              <TokenProvider>
                <OnLoad>{children}</OnLoad>
              </TokenProvider>
            </SdkProvider>
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HashRouter>
  );
};
