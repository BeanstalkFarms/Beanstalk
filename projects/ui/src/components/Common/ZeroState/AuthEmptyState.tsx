import React from 'react';
import { Stack, StackProps, Typography } from '@mui/material';
import useAccount from '~/hooks/ledger/useAccount';
import WalletButton from '~/components/Common/Connection/WalletButton';

/**
 * Similar to EmptyState, but
 * takes into account authentication
 * status.
 * */
import { FC } from '~/types';

const AuthEmptyState: FC<{
  /** Card title */
  title?: string;
  /**
   * Overrides default message
   * when wallet is connected.
   */
  message?: string;
  /**
   * 
   */
  hideWalletButton?: boolean;
} & StackProps> = ({
  message,
  children,
  hideWalletButton = false,
}) => {
  const account = useAccount();
  return (
    <Stack
      sx={{
        height: '100%',
        // place this over the virtual scroller
        zIndex: 10,
        position: 'relative',
      }}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      gap={1}
    >
      {message && <Typography variant="body1" color="text.tertiary">{message}</Typography>}
      {children}
      {!account && !hideWalletButton && <WalletButton variant="contained" color="primary" />}
    </Stack>
  );
};

export default AuthEmptyState;
