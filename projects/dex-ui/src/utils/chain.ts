import { ChainResolver } from "@beanstalk/sdk-core";

import useSdk from "./sdk/useSdk";

/**
 * Returns the current chainId.
 *
 * We want to use the chainId to prevent the possibility of a race condition where we are using an outdated sdk to fetch data.
 *
 */
export function useSdkChainId() {
  return useSdk().chainId;
}

export function useResolvedChainId() {
  const sdkChainId = useSdkChainId();

  return ChainResolver.resolveToMainnetChainId(sdkChainId);
}
