import React from 'react';
import { Alert, AlertProps, SxProps, Theme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FC } from '~/types';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '../IconWrapper';

export type WarningAlertProps = {
  enabled?: boolean;
  iconWrapperSx?: SxProps<Theme>;
  iconSx?: SxProps<Theme>;
} & AlertProps;

const WarningAlert: FC<WarningAlertProps> = ({
  enabled = false,
  iconSx,
  iconWrapperSx,
  ...alertProps
}) => {
  if (!enabled) return null;

  return (
    <Alert
      color="warning"
      icon={
        <IconWrapper boxSize={IconSize.medium} sx={{ ...iconWrapperSx }}>
          <WarningAmberIcon sx={{ fontSize: IconSize.small, ...iconSx }} />
        </IconWrapper>
      }
      {...alertProps}
    />
  );
};
export default WarningAlert;
