import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';

export const updateNFTCollectionsMinted = createAction<{
  [key: string]: BigNumber;
}>('beanstalk/nft/updateNFTCollectionsMinted');
