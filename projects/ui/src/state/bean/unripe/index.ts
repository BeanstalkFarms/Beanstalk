import BigNumber from 'bignumber.js';
import { AddressMap } from '~/constants';

export type UnripeToken = {
  chopRate: BigNumber;
  chopPenalty: BigNumber;
  underlying: BigNumber;
  supply: BigNumber;
  recapPaidPercent: BigNumber;
};

export type Unripe = AddressMap<UnripeToken>;
