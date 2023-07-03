import { Token } from '@beanstalk/sdk';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';

// TODO: Rename this to "legacy" or remove it entirely
export default function useFarmerSiloBalances() {
  return useSelector<AppState, AppState['_farmer']['silo']['balances']>(
    (state) => state._farmer.silo.balances
  );
}

// TODO: Rename this to "useFarmerSiloBalances" after removing the above legacy function
export function useFarmerSiloBalancesSDK() {
  return useSelector<AppState, AppState['_farmer']['silo']['_balances']>(
    (state) => state._farmer.silo._balances
  );
}

// TODO: Rename this to "useFarmerSiloBalance" after removing the above legacy function
export function useFarmerSiloBalanceSDK(token: Token) {
  const balances = useFarmerSiloBalancesSDK();

  return balances.get(token);
}
