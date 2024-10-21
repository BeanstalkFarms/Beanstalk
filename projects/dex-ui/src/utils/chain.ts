import { ChainId, ChainResolver } from "@beanstalk/sdk-core";

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

export const explorerUrl = (chainId: ChainId) => {
  switch (ChainResolver.resolveToMainnetChainId(chainId)) {
    case ChainId.ARBITRUM_MAINNET:
      return `https://arbiscan.io`;
    default:
      return `https://etherscan.io`;
  }
};

export const explorerName = (chainId: ChainId) => {
  switch (ChainResolver.resolveToMainnetChainId(chainId)) {
    case ChainId.ARBITRUM_MAINNET:
      return "Arbiscan";
    default:
      return "Etherscan";
  }
};
