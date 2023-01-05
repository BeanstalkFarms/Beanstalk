import React from 'react';
import { Card, CardProps } from '@mui/material';
import { FC } from '~/types';

export const Module : FC<CardProps> = ({ children, ...props }) => (
  <Card sx={{ position: 'relative' }} {...props}>
    {children}
  </Card>    
);
