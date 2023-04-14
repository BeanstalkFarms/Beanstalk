import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const useFarmerField = () => useSelector<AppState, AppState['_farmer']['field']>((state) => state._farmer.field);

export default useFarmerField;
