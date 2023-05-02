import { Token } from "@beanstalk/sdk";
import React, { createContext, useContext } from "react";

import { useWellTokens } from "src/tokens/useWellTokens";
import { images } from "src/assets/images/tokens";
import { useAccount, useDisconnect } from "wagmi";

const tokenMap: Record<string, Token> = {};
const TokenContext = createContext(tokenMap);

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: tokens, isLoading, error } = useWellTokens();
  const account = useAccount();
  // const { disconnect } = useDisconnect();

  if (isLoading) return <div></div>;
  if (error) {
    if (account.isConnected) {
      return <div>Connected, but to wrong network problably. This needs fixing.</div>;
    } else {
      return <div>Error: ${error.message}</div>;
    }
  }

  const add = (token: Token) => (tokenMap[token.symbol] = token);

  for (const token of tokens!) {
    let logo = images[token.symbol] ?? images.DEFAULT;
    token.setMetadata({ logo });
    add(token);
  }

  return <TokenContext.Provider value={tokenMap}>{children}</TokenContext.Provider>;
};

export const useTokens = () => useContext(TokenContext);
