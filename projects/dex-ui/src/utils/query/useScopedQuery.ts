import { AddressIsh } from "./../../types";
import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import useSdk from "../sdk/useSdk";
import { useCallback } from "react";

const makeScopedQueryKey = (address: AddressIsh, chainId: number, queryKey: QueryKey) => {
  const scope = [address || "no-address", chainId];
  return [scope, ...(typeof queryKey === "string" ? [queryKey] : queryKey)];
};

export function useScopedQuery<
  TQueryFnData,
  TError,
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

  const scopedQueryKey: QueryKey = makeScopedQueryKey(address, chainId, key);

  const modifiedArguments = {
    ...rest,
    queryKey: scopedQueryKey
  } as typeof arg;

  return useQuery(modifiedArguments);
}

export function useScopedQueryKey<TQueryKey extends QueryKey = QueryKey>(queryKey: TQueryKey) {
  const { address } = useAccount();
  const sdk = useSdk();

  return makeScopedQueryKey(address, sdk.chainId, queryKey);
}

export function useSetScopedQueryData<TQueryKey extends QueryKey = QueryKey>() {
  const chainId = useChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    <T>(queryKey: TQueryKey, mergeData: (oldData: undefined | void | T) => T) =>
      queryClient.setQueryData(
        makeScopedQueryKey(address, chainId, queryKey),
        (oldData: undefined | void | T) => {
          const merged = mergeData(oldData);
          return merged;
        }
      ),
    [queryClient, address, chainId]
  );
}
