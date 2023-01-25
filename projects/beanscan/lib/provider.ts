import { Provider, setMulticallAddress } from 'ethers-multicall';
import { ethers } from 'ethers';

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1');

export const provider = new ethers.providers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_RPC_URL,
  { name: 'Unknown', chainId }
);

setMulticallAddress(chainId, '0xeefba1e63905ef1d7acba5a8513c70307c1ce441');
export const ethcallProvider = new Provider(provider, chainId);
