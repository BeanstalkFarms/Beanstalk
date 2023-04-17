import React from 'react';
import { Box } from '@mui/material';

import { FC } from '~/types';

const AccordionWrapper : FC<{}> = ({ children }) => (
  <Box
    sx={{
      background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, rgba(70, 185, 85, 1) 0%, rgba(123, 97, 255, 1) 36.58%, rgba(31, 120, 180, 1) 96.2%) border-box',
      backgroundRepeat: 'no-repeat',
      border: '1px solid transparent',
      borderRadius: 1,
    }}
  >
    {children}
  </Box>
);

export default AccordionWrapper;
