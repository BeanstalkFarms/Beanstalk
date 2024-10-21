import { useCallback } from "react";

import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useChainId } from "wagmi";

import { useSdkChainId } from "../chain";

const makeScopedQueryKey = (chainId: number, queryKey: QueryKey) => {
  const scope = [chainId];
  return [scope, ...(typeof queryKey === "string" ? [queryKey] : queryKey)];
};

/**
 * A hook that wraps `useQuery` and modifies the queryKey to be scoped to the current chainId.
 */
export function useChainScopedQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(arg: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const { queryKey, ...rest } = arg;
  const chainId = useSdkChainId();

  let key: string[] = [];
  if (typeof queryKey === "string") {
    key = [queryKey];
  } else if (Array.isArray(queryKey)) {
    key = queryKey;
  }

  const scopedQueryKey: QueryKey = makeScopedQueryKey(chainId, key);
  const modifiedArguments = {
    ...rest,
    queryKey: scopedQueryKey
  } as typeof arg;

  return useQuery(modifiedArguments);
}

/**
 * A wrapper hook for queryClient.setQueryData, scoped to the current chainId.
 */
export function useSetChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useSdkChainId();

  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey, mergeData: (oldData: undefined | void | T) => T) =>
      queryClient.setQueryData(
        makeScopedQueryKey(chainId, queryKey),
        (oldData: undefined | void | T) => {
          const merged = mergeData(oldData);
          return merged;
        }
      ),
    [queryClient, chainId]
  );
}

/**
 * A wrapper hook for queryClient.getQueryData, scoped to the current chainId.
 */
export function useGetChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useSdkChainId();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey) => queryClient.getQueryData<T>(makeScopedQueryKey(chainId, queryKey)),
    [queryClient, chainId]
  );
}

/**
 * a wrapper hook for queryClient.fetchQuery, scoped to the current chainId.
 */
export function useFetchChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey) =>
      queryClient.fetchQuery<T>({ queryKey: makeScopedQueryKey(chainId, queryKey) }),
    [queryClient, chainId]
  );
}
