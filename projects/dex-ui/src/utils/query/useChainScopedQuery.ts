import { useCallback } from "react";

import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useChainId } from "wagmi";

const makeScopedQueryKey = (chainId: number, queryKey: QueryKey) => {
  const scope = [chainId];
  return [scope, ...(typeof queryKey === "string" ? [queryKey] : queryKey)];
};

export function useChainScopedQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(arg: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const { queryKey, ...rest } = arg;
  const chainId = useChainId();

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

export function useSetChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();

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

export function useGetChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey) => queryClient.getQueryData<T>(makeScopedQueryKey(chainId, queryKey)),
    [queryClient, chainId]
  );
}

export function useFetchChainScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey) =>
      queryClient.fetchQuery<T>({ queryKey: makeScopedQueryKey(chainId, queryKey) }),
    [queryClient, chainId]
  );
}
