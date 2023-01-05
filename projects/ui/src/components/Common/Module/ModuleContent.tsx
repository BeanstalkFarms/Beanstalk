import { Box, BoxProps } from '@mui/material';
import React from 'react';
import { FC } from '~/types';

export const ModuleContent : FC<BoxProps> = ({ children, ...props }) => (
  <Box px={1} pb={1} {...props}>
    {children}
  </Box>
);
