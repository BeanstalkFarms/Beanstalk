import React from "react";
import { HashRouter } from "react-router-dom";
import { FC } from "src/types";
import { client } from "src/utils/WagmiClient";
import { WagmiConfig } from "wagmi";
import SdkProvider from "./SdkProvider";

export const Wrapper: FC<{}> = ({ children }) => (
  <HashRouter>
    <WagmiConfig client={client}>
      <SdkProvider>{children}</SdkProvider>
    </WagmiConfig>
  </HashRouter>
);
