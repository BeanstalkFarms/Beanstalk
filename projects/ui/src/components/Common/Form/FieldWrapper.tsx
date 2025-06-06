import React, { ReactNode } from 'react';
import { Box, Tooltip, Typography, useMediaQuery } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { FC } from '~/types';
import { useTheme } from '@mui/material/styles';
import { FontSize } from '../../App/muiTheme';

const FieldWrapper: FC<{
  label?: ReactNode | string;
  tooltip?: string;
}> = ({ label, tooltip, children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box>
      {label && (
        <Typography
          variant="bodySmall"
          sx={{
            px: 0.5,
            mb: 0.25,
          }}
          display="inline-block"
        >
          {label}&nbsp;
          {tooltip && (
            <Tooltip
              title={tooltip !== undefined ? tooltip : ''}
              placement={isMobile ? 'top' : 'right-start'}
            >
              <HelpOutlineIcon
                sx={{ color: 'text.tertiary', fontSize: FontSize.sm }}
              />
            </Tooltip>
          )}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default FieldWrapper;
