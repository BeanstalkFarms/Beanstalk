import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useFarmerBalances() {
  return useSelector<AppState, AppState['_farmer']['balances']>((state) => state._farmer.balances);
}
