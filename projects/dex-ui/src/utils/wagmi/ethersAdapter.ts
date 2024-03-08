import { providers } from "ethers";
import { useMemo } from "react";
import type { Account, Chain, Client, Transport } from "viem";
import { Config, useClient, useConnectorClient } from "wagmi";

function clientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  };
  if (transport.type === "fallback")
    return new providers.FallbackProvider(
      (transport.transports as ReturnType<Transport>[]).map(({ value }) => new providers.JsonRpcProvider(value?.url, network))
    );
  return new providers.JsonRpcProvider(transport.url, network);
}

function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);

  return signer;
}

/** Hook to convert a viem Client to an ethers.js Provider. */
export function useEthersProvider({ chainId }: { chainId?: number | undefined } = {}) {
  const client = useClient<Config>({ chainId });
  if (!client) {
    throw new Error("No client to create Ethers Adapter");
  }
  return useMemo(() => clientToProvider(client), [client]);
}

/** Hook to convert a Viem Client to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
