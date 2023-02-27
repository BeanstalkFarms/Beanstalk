import React from 'react';
import { Alert, AlertProps, SxProps, Theme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FC } from '~/types';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '../IconWrapper';

export type WarningAlertProps = {
  iconSx?: SxProps<Theme>;
} & AlertProps;

const WarningAlert: FC<WarningAlertProps> = ({
  iconSx,
  ...alertProps
}) => (
  <Alert
    color="warning"
    icon={
      <IconWrapper boxSize={IconSize.medium}>
        <WarningAmberIcon sx={{ fontSize: IconSize.small, ...iconSx }} />
      </IconWrapper>
      }
    {...alertProps}
    />
  );
export default WarningAlert;
