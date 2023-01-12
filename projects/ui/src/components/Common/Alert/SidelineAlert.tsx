import { Alert, AlertProps, lighten } from '@mui/material';
import React from 'react';
import { BeanstalkPalette } from '~/components/App/muiTheme';

export type SidelineAlertProps = {
  hide?: boolean;
} & Omit<AlertProps, 'icon' | 'variant' | 'severity'>;

const accentColorMap = {
  success: BeanstalkPalette.lightGreen,
  info: BeanstalkPalette.lightBlue,
  warning: BeanstalkPalette.lightYellow,
  error: lighten(BeanstalkPalette.trueRed, 0.75),
};

const SidelineAlert: React.FC<SidelineAlertProps> = ({ hide, ...props }) => {
  if (hide) return null;

  return (
    <Alert
      {...props}
      variant="standard"
      icon={false}
      sx={{
        minHeight: 35,
        height: '100%',
        '&.MuiAlert-root': {
          p: 0,
          borderRadius: 1,
          borderLeft: '10px solid',
          borderColor: accentColorMap[props.color || 'info'],
        },
        '& .MuiAlert-message': {
          ml: 1,
          py: 1,
        },
        ...props.sx,
      }}
    >
      {props.children}
    </Alert>
  );
};

export default SidelineAlert;
