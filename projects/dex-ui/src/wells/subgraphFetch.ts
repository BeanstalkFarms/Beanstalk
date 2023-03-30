import request from "graphql-request";
import { type TypedDocumentNode } from "@graphql-typed-document-node/core";

const SUBGRAPH_URL = "http://127.0.0.1:8000/subgraphs/name/beanstalk-wells";

export function fetchFromSubgraphRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables extends Record<string, never> ? undefined : TVariables
): () => Promise<TResult> {
  return async () => request(SUBGRAPH_URL, document, variables ? variables : undefined);
}
