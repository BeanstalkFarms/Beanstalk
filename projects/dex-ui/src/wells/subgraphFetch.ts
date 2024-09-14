import { type TypedDocumentNode } from "@graphql-typed-document-node/core";
import request from "graphql-request";

import { ChainId, ChainResolver } from "@beanstalk/sdk-core";

import { DexSettings, Settings } from "src/settings";

type DexSettingsSubgraphKey = keyof Pick<
  DexSettings,
  "SUBGRAPH_URL" | "SUBGRAPH_URL_ETH" | "BEANSTALK_SUBGRAPH_URL" | "BEANSTALK_SUBGRAPH_URL_ETH"
>;

interface AdditionalSubgraphFetchOptions {
  useBeanstalkSubgraph?: boolean;
}

const getEndpoint = (chainId: ChainId, options?: AdditionalSubgraphFetchOptions) => {
  const base = `${options?.useBeanstalkSubgraph ? "BEANSTALK_" : ""}SUBGRAPH_URL`;
  const key = `${base}${ChainResolver.isL2Chain(chainId) ? "" : "_ETH"}`;

  if (key in Settings) {
    return Settings[key as DexSettingsSubgraphKey];
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
