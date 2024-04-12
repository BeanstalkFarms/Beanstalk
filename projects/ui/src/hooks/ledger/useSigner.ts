import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { TESTNET_RPC_ADDRESSES } from '~/constants';
import { useEthersSigner } from '~/util/wagmi/ethersAdapter';
import useSetting from '../app/useSetting';

// This returns an _ethers_ signer, but one that may be impersonating an account, if we're in dev mode with the right settings.
export const useSigner = () => {
  const [signer, setSigner] = useState<ethers.Signer | undefined>(undefined);
  const { chainId } = useAccount();
  const ethersSigner = useEthersSigner({ chainId });

  const IMPERSONATE_ADDRESS = useSetting('impersonatedAccount')[0];
  const isImpersonating = !!IMPERSONATE_ADDRESS;
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    (async () => {
      if (isImpersonating && isDevMode) {
        try {
          if (!chainId) throw new Error('Cannot impersonate, unknown chainId');
          const provider = new ethers.providers.JsonRpcProvider(
            TESTNET_RPC_ADDRESSES[chainId]
          );
          await provider.send('hardhat_impersonateAccount', [
            IMPERSONATE_ADDRESS,
          ]);
          setSigner(provider.getSigner(IMPERSONATE_ADDRESS));
        } catch (e) {
          console.error(e);
        }
      } else {
        setSigner(ethersSigner);
      }
    })();
  }, [ethersSigner, chainId, IMPERSONATE_ADDRESS, isImpersonating, isDevMode]);

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
