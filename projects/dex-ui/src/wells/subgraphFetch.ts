import request from "graphql-request";
import { type TypedDocumentNode } from "@graphql-typed-document-node/core";
import { Settings } from "src/settings";

export function fetchFromSubgraphRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables extends Record<string, never> ? undefined : TVariables
): () => Promise<TResult> {
  return async () => request(Settings.SUBGRAPH_URL, document, variables ? variables : undefined);
}
