import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useSilo() {
  return useSelector<AppState, AppState['_beanstalk']['silo']>(
    (state) => state._beanstalk.silo
  );
}
