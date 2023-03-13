import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useTemperature() {
  const weather = useSelector<
    AppState,
    AppState['_beanstalk']['field']['weather']['yield']
  >((state) => state._beanstalk.field.weather.yield);
  return weather;
}
