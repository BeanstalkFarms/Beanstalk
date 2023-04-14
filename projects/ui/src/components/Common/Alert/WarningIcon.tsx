import React from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';

import { FC } from '~/types';

const WarningIcon : FC<{}> = () => (
  <IconWrapper boxSize={IconSize.medium}>
    <WarningAmberIcon sx={{ fontSize: IconSize.small }} />
  </IconWrapper>
);

export default WarningIcon;
