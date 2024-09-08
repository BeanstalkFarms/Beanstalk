import { useCallback } from "react";

import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";

import { AddressIsh } from "src/types";


const makeScopedQueryKey = (chainId: number, address: AddressIsh, queryKey: QueryKey) => {
  const scope = [chainId, address || "no-address"];
  return [scope, ...(typeof queryKey === "string" ? [queryKey] : queryKey)];
};

export function useScopedQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(arg: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const { address } = useAccount();
  const chainId = useChainId();

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

export function useSetScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
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

export function useGetScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    (queryKey: TQueryKey) =>
      queryClient.getQueryData(makeScopedQueryKey(chainId, address, queryKey)),
    [queryClient, address, chainId]
  );
}

export function useFetchScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    (queryKey: TQueryKey) =>
      queryClient.fetchQuery({ queryKey: makeScopedQueryKey(chainId, address, queryKey) }),
    [queryClient, address, chainId]
  );
}
