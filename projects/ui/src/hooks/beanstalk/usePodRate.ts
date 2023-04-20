import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const usePodRate = () => {
  const podLine = useSelector<AppState, BigNumber>((state) => state._beanstalk.field.podLine);
  const supply  = useSelector<AppState, BigNumber>((state) => state._bean.token.supply);
  return podLine.dividedBy(supply).multipliedBy(100);
};

export default usePodRate;
