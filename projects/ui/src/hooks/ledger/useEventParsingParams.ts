import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import useAccount from './useAccount';

export type EventParsingParameters = {
  account: string;
  season: BigNumber;
  farmableBeans: BigNumber;
  harvestableIndex: BigNumber;
};

export default function useEventParsingParams() {
  const account     = useAccount();
  const season      = useSeason();
  const earnedBeans = useSelector<AppState, AppState['_farmer']['silo']['beans']['earned']>(
    (state) => state._farmer.silo.beans.earned
  );
  const harvestableIndex = useSelector<AppState, AppState['_beanstalk']['field']['harvestableIndex']>(
    (state) => state._beanstalk.field.harvestableIndex,
  );
  return useMemo<null | EventParsingParameters>(() => {
    if (account && earnedBeans && season?.gt(0) && harvestableIndex?.gt(0)) {
      return {
        account,
        season,
        // only needed for v1
        harvestableIndex: harvestableIndex,
        farmableBeans:    earnedBeans,
      };
    }
    return null;
  }, [
    account,
    season,
    earnedBeans,
    harvestableIndex,
  ]);
}
