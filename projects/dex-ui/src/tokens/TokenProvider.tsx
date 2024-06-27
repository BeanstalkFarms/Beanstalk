import { Token } from "@beanstalk/sdk";
import React, { createContext, useContext } from "react";

import { useWellTokens } from "src/tokens/useWellTokens";
import { images } from "src/assets/images/tokens";
import { Error } from "src/components/Error";
import metadataJson from "src/token-metadata.json";
import { TokenMetadataMap } from "src/types";

const metadataMap = metadataJson as TokenMetadataMap;

const tokenMap: Record<string, Token> = {};
const TokenContext = createContext(tokenMap);

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: tokens, error } = useWellTokens();

  if (error) {
    return <Error message={error?.message} />;
  }

  const add = (token: Token) => (tokenMap[token.symbol] = token);

  for (const token of tokens || []) {
    let logo = images[token.symbol];
    if (!logo) {
      const metadata = metadataMap[token.address.toLowerCase()];
      logo = metadata?.logoURI ?? images.DEFAULT;
    }

    token.setMetadata({ logo });
    add(token);
  }

  return <TokenContext.Provider value={tokenMap}>{children}</TokenContext.Provider>;
};

export const useTokens = () => useContext(TokenContext);
