import { ChainId } from '@beanstalk/sdk-core';
import { providers } from 'ethers';
import { useMemo } from 'react';
import type { Account, Chain, Client, Transport } from 'viem';
import { Config, useClient, useConnectorClient } from 'wagmi';

const SHOW_DEV = import.meta.env.VITE_SHOW_DEV_CHAINS;

const fallbackChain = {
  chainId: SHOW_DEV ? ChainId.LOCALHOST : ChainId.ARBITRUM_MAINNET,
  name: SHOW_DEV ? 'locahost:8545' : 'Arbitrum One',
} as const;

export function clientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client;

  const network = chain
    ? {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
      }
    : fallbackChain;

  if (transport.type === 'fallback')
    return new providers.FallbackProvider(
      (transport.transports as ReturnType<Transport>[]).map(
        ({ value }) => new providers.JsonRpcProvider(value?.url, network)
      )
    );
  return new providers.JsonRpcBatchProvider(transport.url, network);
}

export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = chain
    ? {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
      }
    : fallbackChain;
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);

  return signer;
}

/** Hook to convert a viem Client to an ethers.js Provider. */
export function useEthersProvider({
  chainId,
}: { chainId?: number | undefined } = {}) {
  const client = useClient<Config>({
    chainId: chainId ?? fallbackChain.chainId,
  });
  if (!client) {
    throw new Error('No client to create Ethers Adapter');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => clientToProvider(client), [client?.chain?.id]);
}

/** Hook to convert a Viem Client to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(
    () => (client ? clientToSigner(client) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chainId, client?.account?.address]
  );
}
