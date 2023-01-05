import React, { useCallback } from 'react';
import {
  Connector,
  useAccount as useWagmiAccount,
  useConnect,
} from 'wagmi';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  Stack,
  Typography,
} from '@mui/material';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { grey } from '@mui/material/colors';
import { CONNECT_WALLET_ERRORS, CONNECTOR_LOGOS } from '~/constants/wallets';
import { StyledDialogContent, StyledDialogTitle } from '../Dialog';
import Row from '~/components/Common/Row';
import ethereumLogo from '~/img/tokens/eth-logo-circled.svg';

// -----------------------------------------------------------------

import { FC } from '~/types';

const WalletDialog: FC<{
  handleClose: () => void;
  open: boolean;
  fullScreen: boolean;
}> = ({ handleClose, open, fullScreen }) => {
  const { isConnecting } = useWagmiAccount();
  const { connect, connectors, error, pendingConnector } =
    useConnect({
      onSuccess() {
        handleClose();
      }
  });
  const handleConnect = useCallback(
    (connector: Connector) => () => connect({ connector }),
    [connect]
  );
  return (
    <Dialog onClose={handleClose} open={open} fullScreen={fullScreen}>
      <StyledDialogTitle onClose={handleClose}>
        Connect a wallet
      </StyledDialogTitle>
      <StyledDialogContent sx={{ pb: 1 }}>
        <Stack gap={1} mt={0.5}>
          {connectors.map((connector) => (
            // MetaMaskConnector extends InjectedConnector
            // Injected wallets like Rabby pretend to be MetaMask and so they show up twice
            // If you override the injected connector name it applies to all connectors, even
            //    if they choose a name different from MetaMask
            // Temporary fix: If a wallet returns "MetaMask" as their name but is not an instance of MetaMaskConnector,
            //    it must be an InjectedConnector. The user could connect to this wallet by clicking MetaMask.
            //    So we hide it from the list.
            // FIXME: "cannot redefine property: etherum"
            (!connector.ready || (connector.name === 'MetaMask' && !(connector instanceof MetaMaskConnector)))
              ? null
              : (
                <Button
                  size="large"
                  variant="outlined"
                  color="primary"
                  key={connector.id}
                  disabled={!connector.ready}
                  onClick={handleConnect(connector)}
                  sx={{
                    py: 1,
                    minWidth: fullScreen ? null : 400,
                    borderColor: grey[300]
                  }}
                >
                  <Row justifyContent="space-between" sx={{ width: '100%' }} gap={3}>
                    <Typography color="text.primary" sx={{ fontSize: 20 }}>
                      {isConnecting && (connector.id === pendingConnector?.id)
                        ? <CircularProgress variant="indeterminate" color="primary" size={20} />
                        : connector.name}
                    </Typography>
                    {CONNECTOR_LOGOS[connector.name] ? (
                      <img
                        src={CONNECTOR_LOGOS[connector.name]}
                        alt=""
                        css={{ height: 35 }}
                      />
                    ) : (
                      <img
                        src={ethereumLogo}
                        alt=""
                        css={{ height: 35 }}
                      />
                    )}
                  </Row>
                </Button>
              )
          ))}
          {error && (
            <Alert severity="error">
              {CONNECT_WALLET_ERRORS[error.name || error.message]?.(pendingConnector) || `Error: ${error.message}`}
            </Alert>
          )}
        </Stack>
      </StyledDialogContent>
    </Dialog>
  );
};

export default WalletDialog;
