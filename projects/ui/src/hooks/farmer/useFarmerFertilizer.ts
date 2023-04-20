import { useSelector } from 'react-redux';
import { AppState } from '../../state';

export default function useFarmerFertilizer() {
  return useSelector<AppState, AppState['_farmer']['barn']>((state) => state._farmer.barn);
}
