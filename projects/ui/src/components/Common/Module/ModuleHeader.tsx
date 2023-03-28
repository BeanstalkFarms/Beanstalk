import { Box } from '@mui/material';
import React from 'react';
import { FC } from '~/types';

export const ModuleHeader : FC<{}> = ({ children }) => (
  <Box px={2} pt={2} pb={1.5}>{children}</Box>
);
