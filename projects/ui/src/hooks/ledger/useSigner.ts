import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import useSetting from '../app/useSetting';
import { useAccount } from 'wagmi';
import { TESTNET_RPC_ADDRESSES } from '~/constants';
import { useEthersSigner } from '~/util/wagmi/ethersAdapter';

const IMPERSONATE_ADDRESS = import.meta.env.VITE_OVERRIDE_FARMER_ACCOUNT || useSetting('impersonatedAccount')[0] || '';
const isImpersonating = !!(import.meta.env.DEV && IMPERSONATE_ADDRESS) || useSetting('impersonatedAccount')[0];

// This returns an _ethers_ signer, but one that may be impersonating an account, if we're in dev mode with the right environment variables set.
export const useSigner = () => {
  const [signer, setSigner] = useState<ethers.Signer | undefined>(undefined);
  const { chainId } = useAccount();
  const ethersSigner = useEthersSigner({ chainId });

  useEffect(() => {
    (async () => {
      if (isImpersonating) {
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
  }, [ethersSigner, chainId]);

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
