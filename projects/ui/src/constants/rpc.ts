import { SupportedChainId } from './chains';

/**
 * Unofficial testnets require a custom RPC URL.
 * Ropsten, Goerli etc. are supported by Alchemy.
 */
export const TESTNET_RPC_ADDRESSES: { [chainId: number]: string } = {
  [SupportedChainId.LOCALHOST]: 'http://localhost:8545',
  [SupportedChainId.TESTNET]:
    'https://rpc.vnet.tenderly.co/devnet/silo-v3/3ed19e82-a81c-45e5-9b16-5e385aa74587',
  [SupportedChainId.ANVIL1]: 'https://anvil1.bean.money:443',
  [SupportedChainId.LOCALHOST_ETH]: 'http://localhost:9545',
};