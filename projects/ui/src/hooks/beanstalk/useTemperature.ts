import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useTemperature() {
  return useSelector<AppState, AppState['_beanstalk']['field']['temperature']>(
    (state) => state._beanstalk.field.temperature
  );
}
