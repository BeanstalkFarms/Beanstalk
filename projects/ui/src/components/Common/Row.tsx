import { Stack, StackProps } from '@mui/material';
import React from 'react';

import { FC } from '~/types';

const Row : FC<StackProps> = ({ children, ...props }) => (
  <Stack direction="row" alignItems="center" {...props}>{children}</Stack>
);

export default Row; 
