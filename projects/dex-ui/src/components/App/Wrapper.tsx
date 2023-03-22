import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { client } from "src/utils/wagmi/Client";
import { ConnectKitProvider } from "connectkit";

import { WagmiConfig } from "wagmi";
import { SdkProvider } from "../../utils/sdk/SdkProvider";
import { Avatar } from "src/utils/wagmi/Avatar";

export const Wrapper: FC<{}> = ({ children }) => (
  <HashRouter>
    <WagmiConfig client={client}>
      <ConnectKitProvider
        theme="auto"
        mode="light"
        options={{
          customAvatar: Avatar,
          initialChainId: 0
        }}
      >
        <SdkProvider>{children}</SdkProvider>
      </ConnectKitProvider>
    </WagmiConfig>
  </HashRouter>
);
