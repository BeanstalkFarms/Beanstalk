import { Typography } from '@mui/material';
import React from 'react';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const Soon : FC<{ height?: number }> = ({ height = 300, children }) => (
  <Row justifyContent="center" sx={{ width: '100%', height }} p={2}>
    <Typography textAlign="center" color="gray">
      {children || 'This module is under development and will be available soon.'}
    </Typography>
  </Row>
);

export default Soon;
