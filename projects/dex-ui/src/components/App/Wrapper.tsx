import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { client } from "src/utils/wagmi/Client";
import { ConnectKitProvider } from "connectkit";

import { WagmiConfig } from "wagmi";
import { SdkProvider } from "../../utils/sdk/SdkProvider";
import { Avatar } from "src/utils/wagmi/Avatar";
import { TokenProvider } from "src/utils/TokenProvider";

export const Wrapper: FC<{}> = ({ children }) => (
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
          <TokenProvider>{children}</TokenProvider>
        </SdkProvider>
      </ConnectKitProvider>
    </WagmiConfig>
  </HashRouter>
);
