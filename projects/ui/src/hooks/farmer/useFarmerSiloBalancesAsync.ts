import { Token, DataSource } from '@beanstalk/sdk';

import useAsyncMemo from '~/hooks/display/useAsyncMemo';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { IS_DEV_ENV } from '~/util';


/// Temporary solution. Remove this when we move the site to use the new sdk types.
export default function useFarmerSiloBalancesAsync(token: Token | undefined) {
  const sdk = useSdk();
  const account = useAccount();

  const [farmerBalances, refetchFarmerBalances] = useAsyncMemo(async () => {
    if (!account || !token) return undefined;
    console.debug(`[Transfer] Fetching silo balances for SILO:${token.symbol}`);
    return sdk.silo.getBalance(
      token,
      account,
      IS_DEV_ENV ? { source: DataSource.LEDGER } : undefined
    );
  }, [account, sdk, token]);

  return [farmerBalances, refetchFarmerBalances] as const;
}
