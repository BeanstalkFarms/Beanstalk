import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useFarmerSilo() {
  return useSelector<AppState, AppState['_farmer']['silo']>((state) => state._farmer.silo);
}
