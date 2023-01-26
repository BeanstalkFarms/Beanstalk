'use client';

import { mainnet, localhost } from "@wagmi/chains"
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { configureChains, createClient, WagmiConfig } from "wagmi"

const { provider } = configureChains(
  [mainnet, localhost],
  [
    alchemyProvider({
      apiKey: process.env.NEXT_APP_ALCHEMY_API_KEY || '',
      priority: 0,
    }),
    /// On known networks (homestead, goerli, etc.) Alchemy will
    /// be used by default. In other cases, we fallback to a
    /// provided RPC address for the given testnet chain.
    jsonRpcProvider({
      priority: 1,
      rpc: (_chain) => {
        if (_chain.id === 1337 || _chain.id === 31337) {
          return { http: 'http://localhost:8545' };
        }
        return null;
      },
    })
  ]
);

const client = createClient({
  autoConnect: true,
  provider: provider
});

export default function RootProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WagmiConfig client={client}>
      {children}
    </WagmiConfig>
  )
}