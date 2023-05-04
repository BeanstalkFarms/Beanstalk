import { useSelector } from 'react-redux';
import { selectCurrentSeason } from '~/state/beanstalk/sun/reducer';

export default function useSeason() {
  return useSelector(selectCurrentSeason);
}
