import { Stack, InputAdornment, Typography, Divider } from '@mui/material';
import React from 'react';
import { atom } from 'jotai';
import BigNumber from 'bignumber.js';

import { ONE_BN, ZERO_BN } from '~/constants';
import AtomInputField from '~/components/Common/Atom/AtomInputField';
import AtomOutputField from '~/components/Common/Atom/AtomOutputField';
import Row from '~/components/Common/Row';
import FulfillOrderAmount from '../Common/FulfillOrderAmount';
import PlaceInLineSlider from '../Common/PlaceInLineSlider';
import PricingFnSelect from '../Common/PricingFnSelect';
import { placeInLineAtom, pricePerPodAtom } from '../info/atom-context';
import { FormTokenState } from '~/components/Common/Form';

export type CreateOrderFormValues = {
  placeInLine: BigNumber | null;
  pricePerPod: BigNumber | null;
  tokens: FormTokenState[];
  settings: {
    slippage: number;
  }
}

export const createOrderFormAtom = atom<CreateOrderFormValues>({
  placeInLine: null,
  pricePerPod: null,
  tokens: [],
  settings: {
    slippage: 0.1,
  },
});

const priceInputProps = {
  startAdornment: (
    <InputAdornment position="start">
      <Typography color="text.primary" variant="caption">
        PRICE
      </Typography>
    </InputAdornment>
  ),
  endAdornment: (
    <InputAdornment position="start">
      <Typography color="text.primary" variant="caption">
        BEAN
      </Typography>
    </InputAdornment>
  ),
};

const maxPriceAtom = atom<BigNumber | null>(ONE_BN);

const CreateBuyOrder: React.FC<{}> = () => (
  <Stack gap={0.8}>
    <PlaceInLineSlider />
    {/* (max) place in line input */}
    <AtomOutputField
      atom={placeInLineAtom}
      disabled
      label="MAX PLACE IN LINE"
    />
    <Divider />
    <Row spacing={0.8} width="100%">
      {/* fixed / dynamic pricing fn select */}
      <PricingFnSelect />
      {/* payment amount in beans */}
      <AtomInputField
        atom={pricePerPodAtom}
        InputProps={priceInputProps}
        maxValueAtom={maxPriceAtom}
        min={ZERO_BN}
      />
    </Row>
    <Divider />
    <FulfillOrderAmount />
  </Stack>
);

export default CreateBuyOrder;
