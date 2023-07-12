import { useMemo } from 'react';
import { useAccount as useWagmiAccount } from 'wagmi';
import { getAccount } from '~/util';

export default function useAccount() {
  const account = useWagmiAccount();

  return useMemo(() => {
    if (account?.address) {
      return getAccount(account.address);
    }
    return undefined;
  }, [account?.address]);
}
