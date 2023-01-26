import { providers } from "ethers";
import { Chain } from "wagmi";

export type JsonRpcBatchProviderConfig = Omit<providers.FallbackProviderConfig, 'provider'> & {
  pollingInterval?: number
  rpc: (chain: Chain) => { http: string[]; webSocket?: string[] } | null
}

/**
 * Wrapper around ethers JsonRpcBatchProvider to enable batch behavior within wagmi.
 */
export default function jsonRpcBatchProvider({
  pollingInterval,
  rpc,
  priority,
  stallTimeout,
  weight,
}: JsonRpcBatchProviderConfig) {
  return (_chain: Chain) => {
    const rpcConfig = rpc(_chain);
    if (!rpcConfig || rpcConfig.http[0] === '') return null;
    return {
      chain: {
        ..._chain,
        rpcUrls: {
          ..._chain.rpcUrls,
          default: rpcConfig.http,
        },
      },
      provider: () => {
        const RpcProvider = providers.JsonRpcBatchProvider;
        const provider = new RpcProvider(rpcConfig.http[0], {
          chainId: _chain.id,
          name: _chain.network,
        });
        if (pollingInterval) provider.pollingInterval = pollingInterval;
        return Object.assign(provider, { priority, stallTimeout, weight });
      },
      ...(rpcConfig.webSocket?.[0] && {
        webSocketProvider: () =>
          new providers.WebSocketProvider(
            rpcConfig.webSocket![0] as string,
            _chain.id,
          ),
      }),
    };
  };
}