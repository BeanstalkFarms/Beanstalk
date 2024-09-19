import React from 'react';
import { Box, Typography } from '@mui/material';

const EthMainnet = ({ message }: { message?: string }) => (
  <Box>
    <Typography variant="h1">
      {message || 'We&apos;ve moved to Arbitrum!'}
    </Typography>
  </Box>
);

export default EthMainnet;
