import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import useChainState from '~/hooks/chain/useChainState';

export default function MigrationMessage({ message }: { message?: string }) {
  const { isArbitrum, isTestnet } = useChainState();

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h1">
        {message || isArbitrum ? "We're migrating!" : "We're on Arbitrum!"}
      </Typography>
      <Typography variant="body1" textAlign="center" sx={{ display: 'inline-flex', gap: 0.5 }}>
        Please check
        <Link
          color="primary"
          display="flex"
          flexDirection="row"
          gap={1}
          alignItems="center"
          target="_blank"
          rel="noreferrer"
          href={'https://discord.gg/beanstalk'}
        >
          Discord
        </Link>
        for details.
      </Typography>
    </Box>
  );
}
