import React from 'react';
import { Box, Typography } from '@mui/material';
import useChainState from '~/hooks/chain/useChainState';

export default function MigrationMessage({ message }: { message?: string }) {
  const { isArbitrum, isTestnet } = useChainState();

  return (
    <Box>
      <Typography variant="h1">
        {message || isArbitrum ? "We're migrating!" : "We're migrating!"}
      </Typography>
      <Typography variant="body1" textAlign="center">
        Please check discord for details.
      </Typography>
    </Box>
  );
}
