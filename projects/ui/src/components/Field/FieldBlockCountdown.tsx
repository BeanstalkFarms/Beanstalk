import React from 'react';
import { useSelector } from 'react-redux';
import { selectMorningTime } from '~/state/beanstalk/sun';

const FieldBlockCountdown: React.FC<{}> = () => {
  const { remaining } = useSelector(selectMorningTime);

  return <>{remaining.toFormat('ss')} seconds</>;
};

export default FieldBlockCountdown;
