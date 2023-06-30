import { FarmFromMode, FarmToMode } from '@beanstalk/sdk';

const MODES = {
  [FarmToMode.INTERNAL]: 'Farm Balance',
  [FarmFromMode.INTERNAL]: 'Farm Balance',
  [FarmToMode.EXTERNAL]: 'Circulating Balance',
  [FarmFromMode.EXTERNAL]: 'Circulating Balance',
  [FarmFromMode.INTERNAL_EXTERNAL]: 'Combined Balance',
};

const copy = {
  MODES: MODES,
};

export default copy;
