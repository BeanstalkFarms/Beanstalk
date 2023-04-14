import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const useFarmerListingsLedger = () => useSelector<AppState, AppState['_farmer']['market']['listings']>(
  (state) => state._farmer.market.listings,
);

export default useFarmerListingsLedger;
