import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';

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
