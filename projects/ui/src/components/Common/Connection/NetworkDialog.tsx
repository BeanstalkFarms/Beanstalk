import React, { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import {
  Alert,
  Button,
  Dialog,
  DialogProps,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { SWITCH_NETWORK_ERRORS } from '~/constants/wallets';
import { SupportedChainId, TESTNET_RPC_ADDRESSES } from '~/constants';
import { ETH, ARB } from '~/constants/tokens';
import Row from '~/components/Common/Row';
import { StyledDialogContent, StyledDialogTitle } from '../Dialog';

const CHAIN_ID_TO_LOGO: Record<number, string | undefined> = {
  [SupportedChainId.MAINNET]: ETH[1].logo,
  [SupportedChainId.LOCALHOST]: ETH[1].logo,
  [SupportedChainId.ARBITRUM]: ARB[1].logo,
  [SupportedChainId.LOCALHOST_ARBITRUM]: ARB[1].logo,
};

const NetworkDialog: React.FC<
  DialogProps & {
    open: boolean;
    handleClose?: () => void;
  }
> = ({ open, handleClose, ...props }) => {
  /// Theme
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.down('md'));

  ///
  const { chain: _chain } = useAccount();
  const { chains, error, isPending, switchChain } = useSwitchChain();
  const handleSwitch = useCallback(
    (id: number) => () => {
      if (switchChain) {
        console.debug(`[NetworkButton] switching network => ${id}`);
        switchChain({ chainId: id });
        handleClose?.();
      }
    },
    [switchChain, handleClose]
  );

  return (
    <Dialog onClose={handleClose} open={open} {...props}>
      <StyledDialogTitle onClose={handleClose}>
        Select Network
      </StyledDialogTitle>
      <StyledDialogContent>
        <Stack gap={1}>
          {_chain?.id && !SupportedChainId[_chain.id] ? (
            <Alert severity="info">
              {_chain.name} is not supported. Please select another network
              below.
            </Alert>
          ) : null}
          {chains.map((chain) => (
            <Button
              key={chain.id}
              size="large"
              variant="outlined"
              color="light"
              onClick={handleSwitch(chain.id)}
              sx={{
                py: 1,
                minWidth: isMedium ? null : 400,
                // borderColor: grey[300],
                // '&:hover': {
                //   borderColor: 'primary.main',
                // }
              }}
            >
              <Row
                justifyContent="space-between"
                sx={{ width: '100%' }}
                gap={3}
              >
                <Typography color="text.primary" sx={{ fontSize: 20 }}>
                  {chain.name}
                </Typography>
                {TESTNET_RPC_ADDRESSES[chain.id] ? (
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    {TESTNET_RPC_ADDRESSES[chain.id]}
                  </Typography>
                ) : (
                  <img
                    src={
                      CHAIN_ID_TO_LOGO[chain.id as SupportedChainId] ||
                      ARB[1].logo
                    }
                    alt=""
                    style={{ height: 35 }}
                  />
                )}
              </Row>
            </Button>
          ))}
          {error && (
            <Alert severity="error">
              {/* @ts-ignore */}
              {SWITCH_NETWORK_ERRORS[error.name || error.message](isPending) ||
                error.message}
            </Alert>
          )}
        </Stack>
      </StyledDialogContent>
    </Dialog>
  );
};

export default NetworkDialog;
