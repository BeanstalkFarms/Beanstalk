import { useCallback } from "react";

import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { AddressIsh } from "src/types";

import { useSdkChainId } from "../chain";

const makeScopedQueryKey = (chainId: number, address: AddressIsh, queryKey: QueryKey) => {
  const scope = [chainId, address || "no-address"];
  return [scope, ...(typeof queryKey === "string" ? [queryKey] : queryKey)];
};

/**
 * A hook that wraps `useQuery` and modifies the queryKey to be scoped to the current chainId && connected account.
 */
export function useScopedQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(arg: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const { address } = useAccount();
  const chainId = useSdkChainId();

  const { queryKey, ...rest } = arg;

  let key: string[] = [];
  if (typeof queryKey === "string") {
    key = [queryKey];
  } else if (Array.isArray(queryKey)) {
    key = queryKey;
  }

  const scopedQueryKey: QueryKey = makeScopedQueryKey(chainId, address, key);
  const modifiedArguments = {
    ...rest,
    queryKey: scopedQueryKey
  } as typeof arg;

  return useQuery(modifiedArguments);
}

/**
 * A wrapper hook for queryClient.setQueryData, scoped to the current chainId & connected account.
 */
export function useSetScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useSdkChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey, mergeData: (oldData: undefined | void | T) => T) =>
      queryClient.setQueryData(
        makeScopedQueryKey(chainId, address, queryKey),
        (oldData: undefined | void | T) => {
          const merged = mergeData(oldData);
          return merged;
        }
      ),
    [queryClient, address, chainId]
  );
}

/**
 * A wrapper hook for queryClient.getQueryData, scoped to the current chainId & connected account.
 */
export function useGetScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useSdkChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey) =>
      queryClient.getQueryData<T>(makeScopedQueryKey(chainId, address, queryKey)),
    [queryClient, address, chainId]
  );
}

/**
 * a wrapper hook for queryClient.fetchQuery, scoped to the current chainId & connected account.
 */
export function useFetchScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useSdkChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    (queryKey: TQueryKey) =>
      queryClient.fetchQuery({ queryKey: makeScopedQueryKey(chainId, address, queryKey) }),
    [queryClient, address, chainId]
  );
}
