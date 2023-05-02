import { createReducer } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import {
  BEANFT_BARNRAISE_ADDRESSES,
  BEANFT_GENESIS_ADDRESSES,
  BEANFT_WINTER_ADDRESSES,
  ZERO_BN,
} from '~/constants';
import { BeanNFTSupply } from '.';
import { updateNFTCollectionsMinted } from './actions';

const initialState: BeanNFTSupply = {
  amounts: {
    [BEANFT_GENESIS_ADDRESSES[1]]: {
      totalSupply: new BigNumber(600),
      minted: ZERO_BN,
    },
    [BEANFT_BARNRAISE_ADDRESSES[1]]: {
      totalSupply: new BigNumber(918),
      minted: new BigNumber(918),
    },
    [BEANFT_WINTER_ADDRESSES[1]]: {
      totalSupply: ZERO_BN,
      minted: ZERO_BN,
    },
  },
};

export default createReducer(initialState, (builder) =>
  builder.addCase(updateNFTCollectionsMinted, (state, { payload }) => {
    Object.entries(payload).forEach(([k, v]) => {
      state.amounts[k].minted = v;
    });
  })
);
