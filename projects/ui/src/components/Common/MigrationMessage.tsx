import React from 'react';
import { Box, Typography } from '@mui/material';
import useChainState from '~/hooks/chain/useChainState';

export default function MigrationMessage({ message }: { message?: string }) {

  const { isArbitrum, isTestnet } = useChainState();

  return (
    <Box>
      <Typography variant="h1">
        {message || isArbitrum ? "Coming Soon!" : "We've moved to Arbitrum!"}
      </Typography>
    </Box>
  );
}