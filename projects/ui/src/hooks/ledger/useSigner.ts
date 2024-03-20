import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { useSigner as useWagmiSigner } from 'wagmi';
import useChainId from '~/hooks/chain/useChainId';
import { TESTNET_CHAINS, TESTNET_RPC_ADDRESSES } from '~/constants';
import useSetting from '../app/useSetting';


export let useSigner = useWagmiSigner;



  // @ts-ignore
  useSigner = () => {
    const [signer, setSigner] = useState<ethers.Signer | undefined>(undefined);
    const chainId = useChainId();
    const wagmiSigner = useWagmiSigner();
    const isTestnet = TESTNET_CHAINS.has(chainId);

    const impersonatedAccount = useSetting('impersonatedAccount')[0];
    const account = { address: impersonatedAccount };

    useEffect(() => {
      (async () => {
        if (account.address && isTestnet) {
          try {
            const provider = new ethers.providers.JsonRpcProvider(
              TESTNET_RPC_ADDRESSES[chainId]
            );
            await provider.send('hardhat_impersonateAccount', [
              account.address,
            ]);
            setSigner(provider.getSigner(account.address));
          } catch (e) {
            console.error(e);
          }
        }
      })();
    }, [account?.address, chainId, isTestnet]);

    /// If we're not connected to a testnet and 
    /// not impersonating an address, use the normal signer.
    if (!isTestnet && !impersonatedAccount) return wagmiSigner;

    return {
      data: signer,
      //
      error: null,
      fetchStatus: null,
      internal: null,
      isError: false,
      isFetched: false,
      isFetching: false,
      isIdle: false,
      isLoading: false,
      isRefetching: false,
      isSuccess: false,
      refetch: () => {},
      status: null,
    };
  };
