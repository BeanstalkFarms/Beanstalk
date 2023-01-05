import React, { ReactNode } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { FontSize } from '../../App/muiTheme';

import { FC } from '~/types';

const FieldWrapper : FC<{
  label?: ReactNode | string;
  tooltip?: string
}> = ({
  label,
  tooltip,
  children
}) => (
  <Box>
    {label && (
      <Tooltip
        title={tooltip !== undefined ? tooltip : ''}
        placement="right-start"
      >
        <Typography
          sx={{
            fontSize: 'bodySmall',
            px: 0.5,
            mb: 0.25
          }}
          display="inline-block"
        >
          {label}&nbsp;
          {tooltip && (
            <HelpOutlineIcon
              sx={{ color: 'text.tertiary', fontSize: FontSize.sm }}
            />
          )}
        </Typography>
      </Tooltip>
    )}
    {children}
  </Box>
);

export default FieldWrapper;
