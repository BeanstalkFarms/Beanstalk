import React from 'react';
import { BoxProps } from '@mui/material';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import useAccount from '~/hooks/ledger/useAccount';
import { IconSize } from '~/components/App/muiTheme';
import { BEANSTALK_ADDRESSES } from '~/constants';

import { FC } from '~/types';

const FALLBACK_ADDRESS = BEANSTALK_ADDRESSES[1];

const AddressIcon : FC<BoxProps & {
  size?: number;
  address?: string;
}> = ({
  size = IconSize.medium,
  address,
}) => {
  const account = useAccount();
  const addr = address || account || FALLBACK_ADDRESS; // FIXME naming
  return (
    <Jazzicon
      diameter={size}
      seed={jsNumberForAddress(addr)}
    />
  );
};

export default AddressIcon;
