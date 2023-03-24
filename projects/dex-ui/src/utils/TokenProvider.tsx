import { Token } from "@beanstalk/sdk";
import React, { createContext, useContext } from "react";
import useSdk from "./sdk/useSdk";

import ethLogo from "src/assets/images/tokens/eth-logo-circled.svg";
import wethLogo from "src/assets/images/tokens/weth-logo-circled.svg";
import beanLogo from "src/assets/images/tokens/bean-logo-circled.svg";

const tokens: Record<string, Token> = {};
const TokenContext = createContext(tokens);

// TODO: memoize / usecallback this stuff

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const sdk = useSdk();
  const { WETH, ETH, BEAN } = sdk.tokens;

  ETH.setMetadata({ logo: ethLogo });
  WETH.setMetadata({ logo: wethLogo });
  BEAN.setMetadata({ logo: beanLogo });

  const add = (token: Token) => (tokens[token.symbol] = token);

  add(BEAN);
  add(WETH);

  return <TokenContext.Provider value={tokens}>{children}</TokenContext.Provider>;
};

export const useTokens = () => useContext(TokenContext);
