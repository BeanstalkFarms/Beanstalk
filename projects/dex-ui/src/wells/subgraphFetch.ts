import request from "graphql-request";
import { type TypedDocumentNode } from "@graphql-typed-document-node/core";
import { Settings } from "src/settings";

type AdditionalSubgraphFetchOptions = {
  useBeanstalkSubgraph?: boolean;
};

export function fetchFromSubgraphRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables extends Record<string, never> ? undefined : TVariables,
  options?: AdditionalSubgraphFetchOptions
): () => Promise<TResult> {
  return async () =>
    request(
      options?.useBeanstalkSubgraph ? Settings.BEANSTALK_SUBGRAPH_URL : Settings.SUBGRAPH_URL,
      document,
      variables ? variables : undefined
    );
}
