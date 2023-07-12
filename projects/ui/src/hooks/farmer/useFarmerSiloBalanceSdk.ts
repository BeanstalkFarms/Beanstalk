import { Token } from '@beanstalk/sdk';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useFarmerSiloBalanceSdk(token: Token) {
  const siloBalancesSdk = useSelector<
    AppState,
    AppState['_farmer']['silo']['balancesSdk']
  >((state) => state._farmer.silo.balancesSdk);

  return useMemo(() => siloBalancesSdk.get(token), [siloBalancesSdk, token]);
}
