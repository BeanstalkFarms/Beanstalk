import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const useFarmerPlots = () => useSelector<AppState, AppState['_farmer']['field']['plots']>((state) => state._farmer.field.plots);

export default useFarmerPlots;
