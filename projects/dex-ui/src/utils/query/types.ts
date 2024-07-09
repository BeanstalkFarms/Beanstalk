import { UseQueryOptions } from "@tanstack/react-query";

type Options =
  | "enabled"
  | "staleTime"
  | "refetchInterval"
  | "refetchIntervalInBackground"
  | "refetchOnWindowFocus"
  | "refetchOnReconnect"
  | "refetchOnMount"
  | "retryOnMount"
  | "notifyOnChangeProps"
  | "throwOnError"
  | "placeholderData";

export type UseReactQueryOptions<T, K> = Pick<UseQueryOptions<T>, Options> & {
  select: (data: T) => K;
};
