import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';

export enum FarmFromMode {
  EXTERNAL = '0',
  INTERNAL = '1',
  INTERNAL_EXTERNAL = '2',
  INTERNAL_TOLERANT = '3',
}
export enum FarmToMode {
  EXTERNAL = '0',
  INTERNAL = '1',
}
export enum ClaimRewardsAction {
  MOW = '0',
  PLANT_AND_MOW = '1',
  ENROOT_AND_MOW = '2',
  CLAIM_ALL = '3',
}

export type ChainableFunctionResult = {
  name: string;
  amountOut: ethers.BigNumber;
  value?: ethers.BigNumber;
  data?: any;
  encode: (minAmountOut: ethers.BigNumber) => string;
  decode: (data: string) => Result;
};
export type ChainableFunction = (
  amountIn: ethers.BigNumber,
  forward?: boolean
) => Promise<ChainableFunctionResult>;
