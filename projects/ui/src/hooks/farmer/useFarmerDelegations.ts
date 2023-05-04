import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useFarmerDelegations() {
  return useSelector<AppState, AppState['_farmer']['delegations']>(
    (state) => state._farmer.delegations
  );
}
