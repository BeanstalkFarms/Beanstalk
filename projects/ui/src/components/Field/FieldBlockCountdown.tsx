import React from 'react';
import { useAppSelector } from '~/state';

const FieldBlockCountdown: React.FC<{}> = () => {
  const { remaining } = useAppSelector((s) => s._beanstalk.sun.morningTime);

  return <>{remaining.toFormat('s')} seconds</>;
};

export default FieldBlockCountdown;
