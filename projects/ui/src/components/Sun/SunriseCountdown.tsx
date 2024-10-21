import React from 'react';
import { useRemainingUntilSunrise } from '~/state/beanstalk/sun/updater';

import { FC } from '~/types';

const SunriseCountdown: FC<{}> = () => {
  const remaining = useRemainingUntilSunrise();

  return <>in {remaining.toFormat('mm:ss')}</>;
};

export default SunriseCountdown;
