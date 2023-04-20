import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useFarmerSiloBalances() {
  return useSelector<AppState, AppState['_farmer']['silo']['balances']>((state) => state._farmer.silo.balances);
}
