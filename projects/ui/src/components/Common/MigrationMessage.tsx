import React from 'react';
import { Box, Button, Link, Typography } from '@mui/material';
import useChainState from '~/hooks/chain/useChainState';
import { useSwitchChain } from 'wagmi';

export default function MigrationMessage({ message }: { message?: string }) {
  const { isArbitrum, isTestnet } = useChainState();
  const { chains, error, isPending, switchChain } = useSwitchChain();

  return (
    <Box sx={{ textAlign: 'center', paddingX: 1 }}>
      <Typography variant="h1">
        {message || isArbitrum ? "We're migrating!" : "We're on Arbitrum One!"}
      </Typography>
      <Typography variant="body1" textAlign="center">
        Please check our official channels for details.
      </Typography>
      {!isArbitrum &&
        <Button
          sx={{
            width: "100%",
            mt: 1,
            height: 60,
            backgroundColor: '#213147',
            color: '#12ABFF',
            '&:hover': {
              backgroundColor: '#375278',
            }
          }}
          onClick={() => switchChain({ addEthereumChainParameter: { chainName: "Arbitrum One", rpcUrls: ["https://arb1.arbitrum.io/rpc"] }, chainId: 42161 })}
        >
          Switch to Arbitrum One
        </Button>
      }
    </Box>
  );
}
