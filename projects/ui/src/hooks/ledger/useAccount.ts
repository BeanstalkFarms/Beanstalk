import { useMemo } from 'react';
import { useAccount as useWagmiAccount } from 'wagmi';
import { getAccount } from '~/util';
import useSetting from '../app/useSetting';

export default function useAccount() {
  const account = useWagmiAccount();
  const impersonatedAccount = useSetting('impersonatedAccount')[0];

  return useMemo(() => {
    if (account.address) {
      if (impersonatedAccount) {
        return getAccount(impersonatedAccount);
      }
      return getAccount(account?.address);
    }
    return undefined;
  }, [impersonatedAccount, account?.address]);
}
