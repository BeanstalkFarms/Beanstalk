import React from 'react';

import { FC } from '~/types';

const BlockUpdateCountdown: FC<{}> = () => (
  // const remaining = useSelector<
  //   AppState,
  //   AppState['_beanstalk']['sun']['morning']['time']['remaining']
  // >((state) => state._beanstalk.sun.morning.time.remaining);

  // return <>{remaining.toFormat('mm:ss')}</>;
  <>0:12</>
);
export default BlockUpdateCountdown;
