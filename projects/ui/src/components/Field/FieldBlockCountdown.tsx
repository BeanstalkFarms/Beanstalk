import React from 'react';
import { useRemainingUntilNextMorningInterval } from '~/state/beanstalk/sun/morning';

const FieldBlockCountdown: React.FC<{}> = () => {
  const remaining = useRemainingUntilNextMorningInterval();

  return <>{remaining.toFormat('s')} seconds</>;
};

export default FieldBlockCountdown;
