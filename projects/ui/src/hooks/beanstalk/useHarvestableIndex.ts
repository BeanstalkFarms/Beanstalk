import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const useHarvestableIndex = () => useSelector<AppState, AppState['_beanstalk']['field']['harvestableIndex']>(
  (state) => state._beanstalk.field.harvestableIndex,
);

export default useHarvestableIndex;
