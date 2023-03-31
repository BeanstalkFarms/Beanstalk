import { Token } from "@beanstalk/sdk";
import React, { createContext, useContext } from "react";

import { useWellTokens } from "src/tokens/useWellTokens";
import { images } from "src/assets/images/tokens";

const tokenMap: Record<string, Token> = {};
const TokenContext = createContext(tokenMap);

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: tokens, isLoading, error } = useWellTokens();

  if (isLoading) return <div></div>;
  if (error) return <div>Error loading Tokens: {error.message}</div>;

  if (tokens.length === 0) {
    return <div>Zero Tokens</div>;
  }

  const add = (token: Token) => (tokenMap[token.symbol] = token);

  for (const token of tokens) {
    let logo = images[token.symbol] ?? images.DEFAULT;
    token.setMetadata({ logo });
    add(token);
  }

  // add(new ERC20Token(1, "0x123", 6, "FOO", { logo: images.DEFAULT, name: "Foo" }));

  return <TokenContext.Provider value={tokenMap}>{children}</TokenContext.Provider>;
};

export const useTokens = () => useContext(TokenContext);
