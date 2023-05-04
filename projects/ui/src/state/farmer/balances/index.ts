import BigNumber from 'bignumber.js';
import { AddressMap } from '~/constants';

export type Balance = {
  internal: BigNumber;
  external: BigNumber;
  total: BigNumber;
};

export type ApplicableBalance = {
  total: BigNumber;
  applied: BigNumber;
  remaining: BigNumber;
};

export type FarmerBalances = AddressMap<Balance>;
