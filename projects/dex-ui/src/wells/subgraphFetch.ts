import { type TypedDocumentNode } from "@graphql-typed-document-node/core";
import request from "graphql-request";

import { ChainId, ChainResolver } from "@beanstalk/sdk-core";

import { Settings, SubgraphDexSettings } from "src/settings";

interface AdditionalSubgraphFetchOptions {
  useBeanstalkSubgraph?: boolean;
}

const getEndpoint = (chainId: ChainId, options?: AdditionalSubgraphFetchOptions) => {
  const base = `${options?.useBeanstalkSubgraph ? "BEANSTALK_" : ""}SUBGRAPH_URL`;
  const key = `${base}${ChainResolver.isL2Chain(chainId) ? "" : "_ETH"}`;

  if (key in Settings) {
    return Settings[key as keyof SubgraphDexSettings];
  }

  throw new Error(`${key} is not a key of DexSettings. Unable to determine the subgraph URL`);
};

export function fetchFromSubgraphRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables extends Record<string, never> ? undefined : TVariables,
  chainId: ChainId,
  options?: AdditionalSubgraphFetchOptions
): () => Promise<TResult> {
  return async () =>
    request(getEndpoint(chainId, options), document, variables ? variables : undefined);
}
